<script setup>

import SymbolIndexTreeView from "@/components/SymbolIndexTreeView.vue"

import { SymbolSearchEngine, symbolFilters } from '@/lib/symbol-search.js';

import { ref, onMounted, provide, reactive, computed, watch } from 'vue'

import $ from 'jquery'

const symbolIndexSources = ref([]);
const symbolTree = ref(null);

provide('symbolIndexSources', symbolIndexSources);
provide('symbolTree', symbolTree);

function fetchSymbolIndexSources() {
  $.get("/api/symbols/snapshots", (data) => {
            if (data.success) {
              symbolIndexSources.value = data.source;
            }
        });
}

function fetchSymbolTree() {
  $.get("/api/symbols/tree", (data) => {
            if (data.success) {
              symbolTree.value = data;
            }
        });
}

onMounted(() => {
  console.log(`SymbolIndexView is now mounted.`);
  fetchSymbolIndexSources();
  fetchSymbolTree();
});

/// SEARCH


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

function readSearchEngineState() {
  searchEngineState.running = symbolSearchEngine.running;
  searchEngineState.completed = symbolSearchEngine.finished;
  searchEngineState.state = symbolSearchEngine.state;
  searchEngineState.idle = symbolSearchEngine.state == 'idle';
  searchEngineState.results = symbolSearchEngine.searchResults;
  searchEngineState.progress = symbolSearchEngine.progress;
}

function setupSearchEngine() {
  symbolSearchEngine = new SymbolSearchEngine();

  symbolSearchEngine.onstep = () => {
    readSearchEngineState();
  };
  symbolSearchEngine.oncomplete = () => {
    readSearchEngineState();
  };
}

function restartSearch(inputText) {
  if (!symbolSearchEngine && inputText != "") {
    setupSearchEngine();
  }

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
watch(() => searchEngineState.state, onSearchEngineStateChanged);

watch(searchText, restartSearch);


</script>

<template>
  <div class="content-with-sidebar">
    <nav class="sidebar">
      <h3>Symbols</h3>
      <input v-model="searchText" />
      <div class="search-progress-bar">
        <div v-if="show_progress_bar" class="search-progress-fill" :style="`width: ${searchEngineState.progress * 100}%`">

        </div>
      </div>
      <p v-if="searchText.length && searchEngineState.completed && searchEngineState.results.length == 0">no symbol
        matching pattern
      </p>
      <ul v-if="searchEngineState.results.length > 0" class="search-results">
        <li v-for="result in searchEngineState.results" :key="result.symbol.id" class="search-result-item">
          <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: result.symbol.id } }">
            {{ result.symbol.name }}</RouterLink>
        </li>
      </ul>
      <SymbolIndexTreeView v-show="show_symbol_treeview" :symbolTree="symbolTree"></SymbolIndexTreeView>
    </nav>
    <div class="main-content">
      <RouterView />
    </div>
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