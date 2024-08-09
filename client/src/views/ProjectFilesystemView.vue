<script setup>


import { CodeViewer } from '@cppbrowser/codebrowser'

import { ref, onMounted, watch, inject, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import $ from 'jquery'

const props = defineProps({
  projectName: String,
  projectRevision: String,
  pathParts: Array
});

const router = useRouter();
const route = useRoute();

const isFolder = computed(() => route.name == 'dir');

const navtooltip = inject('navtooltip');

const sourceCode = ref("");

let codeviewer = null;

function scrollToElement(hash) {
  // https://stackoverflow.com/questions/3163615/how-to-scroll-an-html-page-to-a-given-anchor
  let element_to_scroll_to = $(hash)[0];
  element_to_scroll_to.scrollIntoView();
}

let linksGenerator = {
  createLinkToSymbolDefinition(path, symbolId) {
    let routing_options = {
      name: 'file',
      params: {
        projectName: props.projectName,
        projectRevision: props.projectRevision,
        pathParts: path.split("/")
      },
      hash: `#${symbolId}`
    };

    let link = router.resolve(routing_options);

    return {
      href: link.href,
      onclick: () => {
        router.push(routing_options);
        if (path == props.pathParts.join("/")) { // if within same file...
          // ...just scroll to target element
          scrollToElement(`#${symbolId}`);
        }
        return false; // ignore the 'href' when clicking
      }
    };
  },
  createIncludeLink(path) {
    let routing_options = {
      name: 'file',
      params: {
        projectName: props.projectName,
        projectRevision: props.projectRevision,
        pathParts: path.split("/")
      }
    };

    let link = router.resolve(routing_options);

    return {
      href: link.href,
      onclick: () => {
        router.push(routing_options);
        return false; // ignore the 'href' when clicking
      }
    };

  },
  createTooltipMoreLink(symbolId) {
    let routing_options = {
      name: 'symbol',
      params: {
        projectName: props.projectName,
        projectRevision: props.projectRevision,
        symbolId: symbolId
      }
    };

    let link = router.resolve(routing_options);

    return {
      href: link.href,
      onclick: () => {
        codeviewer.tooltip.hide();
        router.push(routing_options);
        return false; // ignore the 'href' when clicking
      }
    };
  }
};

onMounted(() => {
  console.log(`filesystemview is now mounted.`);
  codeviewer = new CodeViewer(document.getElementById('srccodecontainer'), navtooltip.value);
  fetchFileContent();
});

watch(() => props.projectName + "/" + props.projectRevision + "/" + props.pathParts.join("/"), fetchFileContent, { immediate: false });

function setFileContent(data) {
  sourceCode.value = data;
  codeviewer.setPlainText(data);
}

function fetchFileContent() {
  sourceCode.value = "";

  if (!isFolder.value) {
    $.get(`/api/snapshots/${props.projectName}/${props.projectRevision}/files/${props.pathParts.join("/")}`, (data) => {
      setFileContent(data);
      fetchSema();
    });
  } else {
    codeviewer.setPlainText("");
  }
}

function fetchSema() {
    if (!$) {
        console.log("jquery is not available");
        return;
    }

    const url = `/api/snapshots/${props.projectName}/${props.projectRevision}/sema/${props.pathParts.join("/")}`;
    $.get(url, function (data) {
        console.log(data);
        if (!data || !data.success) {
            console.log("error while fetching file's sema");
            // TODO: highlight code using heuristic only
            return;
        }

        codeviewer.setLinksGenerator(linksGenerator);
        codeviewer.setSema(data.file, data.sema);

        if (location.hash) {
            scrollToElement(location.hash);
        }      
    });
}

///// FOLDER

const snapshotFileTree = inject('snapshotFileTree');
const snapshotFileTreeItem = ref(null);

onMounted(() => {
  if (isFolder.value) {
    fetchDirContent();
  }
});

watch(() => props.projectName + "/" + props.projectRevision + "/" + props.pathParts.join("/"), fetchDirContent, { immediate: false });
watch(() => snapshotFileTree, fetchDirContent, { immediate: false });

function fetchDirContent() {
  let full_path = `${props.projectName}/${props.projectRevision}/files/${props.pathParts.join("/")}`;
  console.log("fetching dir content " + full_path);

  let node = snapshotFileTree.value;

  let parts = [...props.pathParts].reverse();

  while (node && parts.length > 0) {
    const p = parts.pop();
    node = node.children.find(n => n.name == p);
  }

  snapshotFileTreeItem.value = node;
}

function getPathParts(f) {
  return f.path.split("/");
}

</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}/{{ pathParts.join("/") }}</h2>
    <div v-show="!isFolder" id="srccodecontainer"></div>
    <div>
      <div v-if="isFolder">
        <h3>Files</h3>
        <table v-if="snapshotFileTreeItem">
          <tbody>
            <tr v-if="pathParts.length > 1">
              <td>
                <RouterLink
                  :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: pathParts.slice(0, -1) } }">..</RouterLink>
              </td>
            </tr>
            <tr v-for="f in snapshotFileTreeItem.children" :key="f.path">
              <td v-if="f.type == 'file'">
                <RouterLink
                  :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">
                  {{ f.name }}</RouterLink>
              </td>
              <td v-if="f.type == 'dir'">
                <RouterLink
                  :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">
                  {{ f.name }}</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
