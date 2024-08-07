<script setup>

import FileTreeView from '@/components/FileTreeView.vue';

import { AsyncFileMatcher } from '@/lib/fuzzy-match';

import { files } from '@/state/files';

import { ref, computed, onMounted, provide, watch } from 'vue'

const props = defineProps({
  projectName: String,
  projectRevision: String
});

provide('projectName', props.projectName);
provide('projectRevision', props.projectRevision);

const myfiles = ref([]);
const myFileTree = ref(null);

provide('snapshotFiles', myfiles);
provide('snapshotFileTree', myFileTree);

function receiveSnapshotFiles(projectName, projectRevision, data) {
  if (projectName == props.projectName && projectRevision == props.projectRevision) {
    myfiles.value = data.files;
    myFileTree.value = data.tree;
  }
}

function fetchSnapshotFiles() {
  console.log(`fetching files for ${props.projectName}/${props.projectRevision}`);
  files.getFilesForSnapshot(props.projectName, props.projectRevision, receiveSnapshotFiles);
}

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

  let matcher = new AsyncFileMatcher(inputText, myfiles.value);
  matcher.onstep = () => {
    onFileSearchStep();
  };
  matcher.oncomplete = () => {
    onFileSearchCompleted();
  };
  matcher.run();
  fileSearchEngine = matcher;
}

function splitPath(path) {
  return path.split("/");
}

watch(() => fileSearchText.value, restartFileSearch, { immediate: false });

onMounted(() => {
  console.log(`snapshotview is now mounted.`);
  fetchSnapshotFiles();
});

watch(() => props.projectName + "/" + props.projectRevision, fetchSnapshotFiles, { immediate: false });

</script>

<template>
  <div class="snapshot-view">
    <nav>
      <div>TODO: version combobox</div>
      <input v-model="fileSearchText"/>
      <h3>Files</h3>
      <FileTreeView v-if="myFileTree" v-show="show_file_treeview" :fileTree="myFileTree"></FileTreeView>
      <p v-if="fileSearchProgress >= 0">progress {{ fileSearchProgress }} </p>
      <ul v-if="fileSearchText.length > 0">
        <li v-for="result in fileSearchResults" :key="result.element">
          <RouterLink :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: splitPath(result.element) } }">{{ result.element }}</RouterLink> ({{ result.score }})
        </li>
      </ul>
    </nav>
    <div>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.snapshot-view {
  display: flex;
}
</style>