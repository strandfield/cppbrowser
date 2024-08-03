<script setup>


import { CodeViewer } from '@cppbrowser/codebrowser'

import { ref, onMounted, watch, inject } from 'vue'
import { useRouter } from 'vue-router'

import $ from 'jquery'

const props = defineProps({
  projectName: String,
  projectRevision: String,
  pathParts: Array
});

const router = useRouter();

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
  console.log(`fileview is now mounted.`);
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

  $.get(`/api/snapshots/${props.projectName}/${props.projectRevision}/files/${props.pathParts.join("/")}`, (data) => {
      setFileContent(data);
      fetchSema();
  });
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


</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}/{{ pathParts.join("/") }}</h2>
    <div id="srccodecontainer"></div>
  </div>
</template>
