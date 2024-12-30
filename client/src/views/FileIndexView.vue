<script setup>

import { FileSearchEngine } from '@/lib/file-search';

import { ref, onMounted, computed, watch, reactive, unref } from 'vue'

import $ from 'jquery'

const apiFileList = ref([]);

function computeFileEntries(files) {
  let result = [];
  for (const f of files) {
    let e = {
      key: f.projectName + ":" + f.path
    };
    Object.assign(e, f);
    result.push(e);
  }

  const collator = new Intl.Collator();
  result.sort((a,b) => collator.compare(a.key, b.key));
  return result;
}

const fileEntries = computed(() => computeFileEntries(apiFileList.value));

function fetchFileList() {
  $.get("/api/files", (data) => {
            if (data.success) {
              apiFileList.value = data.files;
            }
        });
}

// SEARCH

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
    searchEngine.reset(apiFileList.value);
  }
}

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
    searchEngine = new FileSearchEngine(fileEntries.value, (e) => unref(e).key);
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
watch(apiFileList, reconfigureSearchEngine);
watch(() => searchEngineState.state, onSearchEngineStateChanged);

const showFullTable = computed(() => searchText.value.length == 0 || searchEngineState.completed && searchEngineState.results.length == 0);

// onMounted()

onMounted(() => {
  fetchFileList();
});

// TODO: put that in a lib
function getPathParts(path) {
  return path.split("/");
}

</script>

<template>
  <main>
    <h1>Files</h1>
    <input v-model="searchText" />
    <div class="search-progress-bar">
      <div v-if="show_progress_bar" class="search-progress-fill" :style="`width: ${searchEngineState.progress * 100}%`">

      </div>
    </div>
    <p v-if="searchText.length && searchEngineState.completed && searchEngineState.results.length == 0">no file
      matching
      pattern</p>
    <table v-if="searchEngineState.results.length > 0">
      <tbody>
        <tr v-for="searchResult in searchEngineState.results" :key="searchResult.matchId">
          <td>
            <div class="d-flex align-items-center">
              <img src="/file.svg" class="item-icon" />
              <RouterLink
                :to="{ name: 'file', params: { projectName: searchResult.element.projectName, projectRevision: searchResult.element.projectRevision, pathParts: getPathParts(searchResult.element.path) } }">
                {{ searchResult.element.projectName }} &gt; {{ searchResult.element.path }}</RouterLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <table v-show="showFullTable">
      <tbody>
        <tr v-for="e in fileEntries" :key="e.key">
          <td>
            <div class="d-flex align-items-center">
              <img src="/file.svg" class="item-icon" />
              <RouterLink
                :to="{ name: 'file', params: { projectName: e.projectName, projectRevision: e.projectRevision, pathParts: getPathParts(e.path) } }">
                {{ e.projectName }} &gt; {{ e.path }}</RouterLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>

/* TODO: put that in a css */
.item-icon {
  margin-right: 0.5em;
}

</style>