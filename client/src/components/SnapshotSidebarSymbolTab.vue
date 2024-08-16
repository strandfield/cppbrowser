<script setup>

import SnapshotSymbolTreeView from '@/components/SnapshotSymbolTreeView.vue';

import { SymbolSearchEngine, symbolFilters } from '@/lib/symbol-search.js';

import { ref, computed, onMounted, inject, watch, reactive } from 'vue'

const projectName = inject('projectName');
const projectRevision = inject('projectRevision');

const searchText = ref("");
let symbolSearchEngine = null;
const searchEngineState = reactive({
  progress: -1,
  results: [],
  state: 'idle',
  running: false,
  completed: false,
  idle: true
});

const show_symbol_treeview = computed(() => {
  return searchEngineState.idle;
});

const show_progress_bar = ref(false);

function readSearchEngineState() {
  searchEngineState.running = symbolSearchEngine.running;
  searchEngineState.completed = symbolSearchEngine.finished;
  searchEngineState.state = symbolSearchEngine.state;
  searchEngineState.idle = symbolSearchEngine.state == 'idle';
  searchEngineState.results = symbolSearchEngine.searchResults;
  searchEngineState.progress = symbolSearchEngine.progress;
}

function restartSearch(inputText) {
  if (symbolSearchEngine && symbolSearchEngine.inputText == inputText) {
    return;
  }

  let has_filter = false;
  for (const key in symbolFilters) {
    if (inputText.startsWith(key + " ")) {
      has_filter = true;
      symbolSearchEngine.filter = key;
      inputText = inputText.substring(2);
      break;
    }
  }

  if (!has_filter) {
    symbolSearchEngine.filter = null;
  }

  symbolSearchEngine.setSearchText(inputText);
  readSearchEngineState();
}

function reconfigureSearchEngine() {
  console.log(`need to reconf search engine for version ${projectName.value}/${projectRevision.value}`);
  symbolSearchEngine.reconfigure({
    projectName: projectName.value,
    projectRevision: projectRevision.value
  });
}

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

onMounted(() => {
  symbolSearchEngine = new SymbolSearchEngine({
    projectName: projectName.value,
    projectRevision: projectRevision.value
  });

  symbolSearchEngine.onstep = () => {
    readSearchEngineState();
  };
  symbolSearchEngine.oncomplete = () => {
    readSearchEngineState();
  };
});

watch(projectName, reconfigureSearchEngine, { immediate: false });
watch(projectRevision, reconfigureSearchEngine, { immediate: false });

watch(() => searchText.value, restartSearch, { immediate: false });

watch(() => searchEngineState.state, onSearchEngineStateChanged);

</script>

<template>
  <div>
    <input v-model="searchText" />
    <div class="search-progress-bar">
      <div v-if="show_progress_bar" class="search-progress-fill" :style="`width: ${searchEngineState.progress*100}%`">

      </div>
    </div>
    <p v-if="searchText.length && searchEngineState.completed && searchEngineState.results.length == 0">no symbol
      matching pattern
    </p>
    <ul v-if="searchEngineState.results.length > 0" class="search-results">
      <li v-for="result in searchEngineState.results" :key="result.symbol.id" class="search-result-item">
        <RouterLink :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: result.symbol.id } }">{{ result.symbol.name }}</RouterLink>
      </li>
    </ul>
    <SnapshotSymbolTreeView v-show="show_symbol_treeview" :projectName="projectName" :projectRevision="projectRevision">
    </SnapshotSymbolTreeView>
  </div>
</template>

<style scoped>
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

.search-result-item {
  border-bottom: 1px solid lightgray;
  display: flex;
  white-space: nowrap;
}

.search-result-item a {
  display: inline-block;
  text-overflow: ellipsis;
  overflow: hidden;
  direction: rtl;
  flex-shrink: 1;
}
</style>