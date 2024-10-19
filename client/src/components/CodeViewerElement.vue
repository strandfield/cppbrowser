<script setup>

import { CodeViewer } from '@cppbrowser/codebrowser'

import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import $ from 'jquery'

const el = ref();
const srccodecontainer = ref();

const props = defineProps({
  projectName: String,
  projectRevision: String,
  pathParts: Array,
  startLine: {
    type: Number,
    default: 1
  },
  endLine: {
    type: Number,
    default: -1
  }
});

const router = useRouter();

//const navtooltip = inject('navtooltip');

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
        router.push(routing_options);
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
  createTooltipMoreLink(/* symbolId */) {
    return null;
  }
};

onMounted(() => {
  console.log(`filesystemview is now mounted.`);
  const tooltipElement = null;
  codeviewer = new CodeViewer(srccodecontainer.value, tooltipElement);
  codeviewer.documentMode = false;
  fetchFileContent();
});

watch(() => props.projectName + "/" + props.projectRevision + "/" + props.pathParts.join("/"), fetchFileContent, { immediate: false });

watch(() => ({startLine: props.startLine, endLine: props.endLine}), updateLineRange);

function setFileContent(data) {
  sourceCode.value = data;
  codeviewer.setPlainText(data);
  codeviewer.setLineRange(props.startLine, props.endLine);
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

function updateLineRange(range)
{
  if (codeviewer) {
    codeviewer.setLineRange(range.startLine, range.endLine);
  }
}

</script>

<template>
  <div ref="el" class="code-viewer-element">
    <div ref="srccodecontainer" class="srccodecontainer"></div>
  </div>
</template>

<style scoped>

.srccodecontainer {
  margin-top: 1em;
  border: 1px solid lightgrey;
}

</style>