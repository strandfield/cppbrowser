<script setup>

import SnapshotSymbolTreeView from '@/components/SnapshotSymbolTreeView.vue';

import { SymbolSearchEngine } from '@/lib/symbol-search.js';

import { ref, computed, onMounted, inject, watch, reactive } from 'vue'

const projectName = inject('projectName');
const projectRevision = inject('projectRevision');

const searchText = ref("");
let symbolSearchEngine = null;
const searchEngineState = reactive({
  progress: -1,
  results: [],
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
  searchEngineState.idle = symbolSearchEngine.state == 'idle';
  searchEngineState.results = symbolSearchEngine.searchResults;
  searchEngineState.progress = symbolSearchEngine.progress;
}

function restartSearch(inputText) {
  if (symbolSearchEngine && symbolSearchEngine.inputText == inputText) {
    return;
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


</script>

<template>
  <div>
    <input v-model="searchText" />
    <SnapshotSymbolTreeView v-show="show_symbol_treeview" :projectName="projectName" :projectRevision="projectRevision">
    </SnapshotSymbolTreeView>
    <p v-if="searchEngineState.running">progress {{ searchEngineState.progress }} </p>
    <p v-if="searchText.length && searchEngineState.completed && searchEngineState.results.length == 0">no symbol
      matching pattern
    </p>
    <ul v-if="searchEngineState.results.length > 0">
      <li v-for="result in searchEngineState.results" :key="result.symbol.id">
        <RouterLink :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: result.symbol.id } }">{{ result.symbol.name }}</RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>

</style>