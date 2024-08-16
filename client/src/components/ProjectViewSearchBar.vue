<script setup>

import SnapshotFileSearchResultItem from '@/components/SnapshotFileSearchResultItem.vue';

import { FileSearchEngine } from '@/lib/file-search.js';
import { SymbolSearchEngine } from '@/lib/symbol-search.js';

import { ref, inject, watch, reactive } from 'vue'
import { useRoute } from 'vue-router';

const projectName = inject('projectName');
const projectRevision = inject('projectRevision');
const snapshotFiles = inject('snapshotFiles');

const searchText = ref("");
const searchMode = ref('file');

const route = useRoute();

const hasFocus = ref(false);


///

let fileSearchEngine = null;
const fileSearchEngineState = reactive({
  progress: -1,
  results: [],
  running: false,
  completed: false,
  idle: true
});

function readFileSearchEngineState() {
  fileSearchEngineState.running = fileSearchEngine.running;
  fileSearchEngineState.completed = fileSearchEngine.finished;
  fileSearchEngineState.idle = fileSearchEngine.state == 'idle';
  fileSearchEngineState.results = fileSearchEngine.searchResults;
  fileSearchEngineState.progress = fileSearchEngine.progress;
}

function onFileSearchStep(results_changed) {
  if (results_changed) {
    fileSearchEngineState.results = fileSearchEngine.searchResults;
  }
  fileSearchEngineState.progress = fileSearchEngine.progress;
}

function onFileSearchCompleted() {
  readFileSearchEngineState();
}

let symbolSearchEngine = null;
const symbolSearchEngineState = reactive({
  progress: -1,
  results: [],
  running: false,
  completed: false,
  idle: true
});

function readSymbolSearchEngineState() {
  symbolSearchEngineState.running = symbolSearchEngine.running;
  symbolSearchEngineState.completed = symbolSearchEngine.finished;
  symbolSearchEngineState.idle = symbolSearchEngine.state == 'idle';
  symbolSearchEngineState.results = symbolSearchEngine.searchResults;
  symbolSearchEngineState.progress = symbolSearchEngine.progress;
}

function onSearchTextChanged(inputText) {
  if (inputText == "") {
    if (fileSearchEngine) {
      fileSearchEngine.setSearchText(inputText);
      readFileSearchEngineState();
    }

    if (symbolSearchEngine) {
      symbolSearchEngine.setSearchText(inputText);
      readSymbolSearchEngineState();
    }

    searchMode.value = 'file';
    return;
  }

  const symbol_search = inputText.startsWith("#");

  if (symbol_search) {
    searchMode.value = 'symbol';
    inputText = inputText.substring(1);

    if (!symbolSearchEngine) {
      symbolSearchEngine = new SymbolSearchEngine({
        projectName: projectName.value,
        projectRevision: projectRevision.value
      });
    }

    symbolSearchEngine.onstep = () => {
      readSymbolSearchEngineState();
    };
    symbolSearchEngine.oncomplete = () => {
      readSymbolSearchEngineState();
    };

    symbolSearchEngine.setSearchText(inputText);
    readSymbolSearchEngineState();
  } else {
    searchMode.value = 'file';
    if (!fileSearchEngine) {
      fileSearchEngine = new FileSearchEngine(snapshotFiles.value);
      fileSearchEngine.onstep = onFileSearchStep;
      fileSearchEngine.oncomplete = onFileSearchCompleted;
    }

    if (fileSearchEngine.inputText != inputText) {
      fileSearchEngine.setSearchText(inputText);
      readFileSearchEngineState();
    }
  }
}

function resetSearchText() {
  searchText.value = "";
}

function reconfigureSearchEngines() {
  if (symbolSearchEngine) {
    console.log(`need to reconf search engine for version ${projectName.value}/${projectRevision.value}`);

    symbolSearchEngine.reconfigure({
      projectName: projectName.value,
      projectRevision: projectRevision.value
    });
  }

  if (fileSearchEngine) {
    fileSearchEngine.reset(snapshotFiles.value);
  }
}

function onFocus() {
  hasFocus.value = true;
}

function onBlur(param) {
  //hidePopup();
}

function hidePopup() {
  setTimeout(() => {
      hasFocus.value = false;
    }, 1);
}

function onFocusOut(param) {
  let root = document.getElementById('project-search-bar');
  if (!param.relatedTarget || !root.contains(param.relatedTarget)) {
    hidePopup();
  }
}

watch(projectName, reconfigureSearchEngines, { immediate: false });
watch(projectRevision, reconfigureSearchEngines, { immediate: false });
watch(snapshotFiles, reconfigureSearchEngines);

watch(searchText, onSearchTextChanged);
watch(route, hidePopup);

</script>
<template>
  <div id="project-search-bar" @focusout="onFocusOut">
    <input v-model="searchText" @blur="onBlur" @focus="onFocus" />
    <div v-if="hasFocus" class="dropdown">
      <template v-if="searchMode == 'symbol'">
        <p v-if="symbolSearchEngineState.running">progress {{ symbolSearchEngineState.progress }} </p>
        <p v-if="searchText.length && symbolSearchEngineState.completed && symbolSearchEngineState.results.length == 0">
          no
          symbol
          matching pattern
        </p>
        <ul v-if="symbolSearchEngineState.results.length > 0">
          <li v-for="result in symbolSearchEngineState.results" :key="result.symbol.id">
            <RouterLink
              :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: result.symbol.id } }">
              {{ result.symbol.name }}</RouterLink>
          </li>
        </ul>
      </template>
      <template v-else-if="searchMode == 'file'">
        <p v-if="fileSearchEngineState.running">progress {{ fileSearchEngineState.progress }} </p>
        <p v-if="searchText.length && fileSearchEngineState.completed && fileSearchEngineState.results.length == 0">no
          symbol
          matching pattern
        </p>
        <ul v-if="fileSearchEngineState.results.length > 0">
          <SnapshotFileSearchResultItem v-for="result in fileSearchEngineState.results" :key="result.matchId"
            :matchResult="result">
          </SnapshotFileSearchResultItem>
        </ul>
      </template>
    </div>
  </div>
</template>

<style scoped>
.dropdown {
  position: absolute;
  background-color: #f9f9f9;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 1;
  right: 1rem;
}

ul {
  padding: 0;
  list-style: none;
}

li {
  padding: 0.2em;
}

</style>