<script setup>

import FileTreeView from '@/components/FileTreeView.vue';
import SnapshotFileSearchResultItem from '@/components/SnapshotFileSearchResultItem.vue';

import { AsyncFileMatcher } from '@/lib/fuzzy-match';

import { CodeViewer } from '@cppbrowser/codebrowser'

import { ref, onMounted, watch, inject, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import $ from 'jquery'

const snapshotFiles = inject('snapshotFiles');
const snapshotFileTree = inject('snapshotFileTree');

const props = defineProps({
  projectName: String,
  projectRevision: String,
  pathParts: Array
});

const router = useRouter();
const route = useRoute();

const isFolder = computed(() => route.name == 'dir');
const fileName = computed(() => props.pathParts.at(props.pathParts.length - 1));
const breadcrumbParts = computed(() => {
  if (props.pathParts.length == 1) {
    return [];
  }
  const parts = props.pathParts.slice(0, -1);
  let result = [];
  for (let i = 0; i < parts.length; ++i) {
    let pp = parts.slice(0, i+1);
    result.push({
      name: parts[i],
      path: pp.join("/"),
      parts: pp
    });
  }
  return result;
});

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

// SIDEBAR


const treeview_mode = ref('files');

const fileSearchText = ref("");
let fileSearchEngine = null;
const fileSearchResults = ref([]);
const fileSearchProgress = ref(-1);
const fileSearchCompleted = ref(false);

const show_file_treeview = computed(() => {
  return treeview_mode.value == 'files' && fileSearchText.value == "";
});

function onFileSearchStep() {
  const max_results = 32;
  let results = fileSearchResults.value.concat(fileSearchEngine.matches);
  fileSearchEngine.flush();
  results.sort((a,b) => b.score - a.score);
  if (results.length > max_results) {
    results = results.slice(0, max_results);
  }
  fileSearchResults.value = results;
  fileSearchProgress.value = fileSearchEngine.progress;
}

function onFileSearchCompleted() {
  fileSearchCompleted.value = true;
  fileSearchProgress.value = -1;
  fileSearchEngine = null;
}

function restartFileSearch(inputText) {
  if (fileSearchEngine && fileSearchEngine.inputText == inputText) {
    return;
  }

  if (fileSearchEngine) {
    fileSearchEngine.cancel();
    fileSearchEngine = null;
  }

  fileSearchResults.value = [];
  fileSearchProgress.value = inputText == "" ? -1 : 0;
  fileSearchCompleted.value = false;

  if (inputText == "") {
    return;
  }

  let matcher = new AsyncFileMatcher(inputText, snapshotFiles.value);
  matcher.onstep = () => {
    onFileSearchStep();
  };
  matcher.oncomplete = () => {
    onFileSearchCompleted();
  };
  matcher.run();
  fileSearchEngine = matcher;
}

watch(() => fileSearchText.value, restartFileSearch, { immediate: false });

</script>
<template>
  <div class="content-with-sidebar">
    <div class="sidebar">
      <h3>Files</h3>
      <input v-model="fileSearchText" />
      <FileTreeView v-if="snapshotFileTree" v-show="show_file_treeview" :fileTree="snapshotFileTree"></FileTreeView>
      <p v-if="fileSearchProgress >= 0">progress {{ fileSearchProgress }} </p>
      <p v-if="fileSearchText.length && fileSearchCompleted >= 0 && fileSearchResults.length == 0">no file matching
        pattern</p>
      <ul v-if="fileSearchText.length > 0">
        <SnapshotFileSearchResultItem v-for="result in fileSearchResults" :key="result.element" :matchResult="result">
        </SnapshotFileSearchResultItem>
      </ul>
    </div>
    <div class="main-content">
      <div class="breadcrumb">
        <nav>
          <ol>
            <li><RouterLink :to="{ name: 'snapshot', params: { projectName: projectName, projectRevision: projectRevision } }">{{ projectName }}</RouterLink></li>
            <li v-for="part in breadcrumbParts" :key="part.path">
              <span class="dir-separator">/</span>
              <RouterLink :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: part.parts } }">{{ part.name }}</RouterLink>
            </li>
          </ol>
        </nav>
        <div class="here">
          <span class="filename-separator">/</span>
          <h1 id="filename">{{ fileName }}</h1>
        </div>
      </div>
      <div v-show="!isFolder" id="srccodecontainer"></div>
      <div>
        <div v-if="isFolder">
          <h3>Files</h3>
          <table v-if="snapshotFileTreeItem">
            <tbody>
              <tr v-if="pathParts.length > 1">
                <td>
                  <RouterLink
                    :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: pathParts.slice(0, -1) } }">
                    ..</RouterLink>
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
  </div>
</template>

<style scoped>
.content-with-sidebar {
  display: flex;
}

.breadcrumb {
  font-size: 16px;
  display: flex;
}

.breadcrumb nav ol {
  display: flex;
  list-style: none;
  padding: 0;
}

.breadcrumb .here h1 {
  display: inline-block;
  font-size: 16px;
}

.breadcrumb .here .filename-separator {
  padding-left: 4px;
  padding-right: 4px;
}

</style>