<script setup>

import FileTreeView from '@/components/FileTreeView.vue';
import SnapshotFileSearchResultItem from '@/components/SnapshotFileSearchResultItem.vue';

import { FileSearchEngine } from '@/lib/file-search';

import { CodeViewer } from '@cppbrowser/codebrowser'

import { ref, reactive, onMounted, watch, inject, computed } from 'vue'
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
watch(snapshotFileTree, fetchDirContent, { immediate: false });

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

const searchText = ref("");
let searchEngine = null;
const searchEngineState = reactive({
  progress: -1,
  results: [],
  state: 'idle',
  running: false,
  completed: false,
  idle: true
});

function readSearchEngineState() {
  searchEngineState.running = searchEngine.running;
  searchEngineState.completed = searchEngine.finished;
  searchEngineState.state = searchEngine.state;
  searchEngineState.idle = searchEngine.state == 'idle';
  searchEngineState.results = searchEngine.searchResults;
  searchEngineState.progress = searchEngine.progress;
}

function reconfigureSearchEngine() {
  if (searchEngine) {
    searchEngine.reset(snapshotFiles.value);
  }
}

const show_file_treeview = computed(() => {
  return searchText.value == "";
});

function onSearchStep(results_changed) {
  if (results_changed) {
    searchEngineState.results = searchEngine.searchResults;
  }
  searchEngineState.progress = searchEngine.progress;
}

function onSearchCompleted() {
  readSearchEngineState();
}

function onSearchTextChanged(inputText) {
  if (!searchEngine) {
    searchEngine = new FileSearchEngine(snapshotFiles.value);
    searchEngine.onstep = onSearchStep;
    searchEngine.oncomplete = onSearchCompleted;
  }

  if (searchEngine.inputText != inputText) {
    searchEngine.setSearchText(inputText);
    readSearchEngineState();
  }
}

const show_progress_bar = ref(false);

function showProgressBar() {
  if (searchEngineState.running) {
    show_progress_bar.value = true;
  }
}

function hideProgressBar() {
  if (searchEngineState.completed || searchEngineState.idle) {
    show_progress_bar.value = false;
  }
}

function onSearchEngineStateChanged(state) {
  if (state == 'idle') {
    show_progress_bar.value = false;
  } else if (state == 'running') {
    if (!show_progress_bar.value) {
      setTimeout(showProgressBar, 100);
    }
  } else if (state == 'finished') {
    setTimeout(hideProgressBar, 250);
  }
}

watch(() => searchText.value, onSearchTextChanged, { immediate: false });
watch(snapshotFiles, reconfigureSearchEngine);
watch(() => searchEngineState.state, onSearchEngineStateChanged);


</script>

<template>
  <div class="content-with-sidebar">
    <div class="sidebar">
      <h2>Files</h2>
      <input v-model="searchText" />
      <div class="search-progress-bar">
        <div v-if="show_progress_bar" class="search-progress-fill" :style="`width: ${searchEngineState.progress * 100}%`">

        </div>
      </div>
      <p v-if="searchText.length && searchEngineState.completed && searchEngineState.results.length == 0">no file
        matching
        pattern</p>
      <ul v-if="searchText.length > 0" class="search-results">
        <SnapshotFileSearchResultItem v-for="result in searchEngineState.results" :key="result.matchId"
          :matchResult="result">
        </SnapshotFileSearchResultItem>
      </ul>
      <FileTreeView v-if="snapshotFileTree" v-show="show_file_treeview" :fileTree="snapshotFileTree"></FileTreeView>
    </div>
    <main class="main-content">
      <div class="breadcrumb">
        <nav>
          <ol>
            <li>
              <RouterLink
                :to="{ name: 'snapshot', params: { projectName: projectName, projectRevision: projectRevision } }">{{
                projectName }}</RouterLink>
            </li>
            <li v-for="part in breadcrumbParts" :key="part.path">
              <span class="dir-separator">/</span>
              <RouterLink
                :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: part.parts } }">
                {{ part.name }}</RouterLink>
            </li>
          </ol>
        </nav>
        <div class="here">
          <span class="filename-separator">/</span>
          <h1 id="filename">{{ fileName }}</h1>
        </div>
      </div>
      <!-- TODO: use CodeViewerElement -->
      <div v-show="!isFolder" id="srccodecontainer"></div> 
      <div>
        <div v-if="isFolder">
          <table v-if="snapshotFileTreeItem">
            <tbody>
              <tr v-if="pathParts.length > 1">
                <td>
                  <div class="d-flex align-items-center">
                  <img src="/folder.svg" class="item-icon"/>
                  <RouterLink
                    :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: pathParts.slice(0, -1) } }">
                    ..</RouterLink>
                  </div>
                </td>
              </tr>
              <tr v-for="f in snapshotFileTreeItem.children" :key="f.path">
                <td v-if="f.type == 'file'">
                  <div class="d-flex align-items-center">
                  <img src="/file.svg" class="item-icon"/>
                  <RouterLink
                    :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">
                    {{ f.name }}</RouterLink>
                  </div>
                </td>
                <td v-if="f.type == 'dir'">
                  <div class="d-flex align-items-center">
                  <img src="/folder.svg" class="item-icon"/>
                  <RouterLink
                    :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">
                    {{ f.name }}</RouterLink>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>

.content-with-sidebar {
  display: flex;
}

.sidebar {
  padding: 1rem;
  width: 320px;
}

.main-content {
  flex-grow: 1;
}

.search-progress-bar {
  width: 100%;
  height: 2px;
  margin-top: 4px;
}

.search-progress-fill {
  background-color: green;
  height: 2px;
}

.search-results {
  list-style: none;
  padding: 0;
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

.breadcrumb .dir-separator {
  padding: 0 0.3em;
}

table {
  margin-top: 1em;
  border: 1px solid lightgray;
  width: 100%;
  border-collapse: collapse;
}

td {
  padding: 0.4em 0;
  border: 1px solid lightgrey;
  padding-left: 1em;
}

.item-icon {
  margin-right: 0.5em;
}

#srccodecontainer {
  margin-top: 1em;
  border: 1px solid lightgrey;
}

</style>