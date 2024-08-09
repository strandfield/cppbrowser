<script setup>

import FileTreeView from '@/components/FileTreeView.vue';
import SnapshotFileSearchResultItem from '@/components/SnapshotFileSearchResultItem.vue';

import { AsyncFileMatcher } from '@/lib/fuzzy-match';

import { files } from '@/state/files';
import { snapshots } from '@/state/snapshots';

import { useRoute, useRouter } from 'vue-router'

import { ref, computed, onMounted, provide, watch } from 'vue'
import SnapshotSidebarSymbolTab from '@/components/SnapshotSidebarSymbolTab.vue';

const route = useRoute();
const router = useRouter();

const props = defineProps({
  projectName: String,
  projectRevision: String
});

provide('projectName', props.projectName);
provide('projectRevision', props.projectRevision);

const project = ref(null);

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

const selectedRevision = ref(null);

const treeview_mode = ref('files');

const fileSearchText = ref("");
let fileSearchEngine = null;
const fileSearchResults = ref([]);
const fileSearchProgress = ref(-1);
const fileSearchCompleted = ref(false);

const show_file_treeview = computed(() => {
  return treeview_mode.value == 'files' && fileSearchText.value == "";
});

const show_symbol_treeview = computed(() => {
  return treeview_mode.value == 'symbols';
});

function switchSidebar() {
    if (treeview_mode.value == 'files') {
      treeview_mode.value = 'symbols';
    } else {
      treeview_mode.value = 'files';
    }
}

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

watch(() => fileSearchText.value, restartFileSearch, { immediate: false });

function fetchProject(name = null) {
  if (!name) {
    name = props.projectName;
  }
  project.value = snapshots.getProject(name);
}

onMounted(() => {
  console.log(`snapshotview is now mounted.`);
  fetchProject();
  fetchSnapshotFiles();
  selectedRevision.value = props.projectRevision;
});

watch(() => props.projectName, fetchProject, { immediate: false });
watch(() => props.projectName + "/" + props.projectRevision, fetchSnapshotFiles, { immediate: false });

function changeSelectedRevision() {
  if (selectedRevision.value != props.projectRevision) {
    let routing_options = {
      name: route.name,
      params: {

      },
      hash: route.hash
    };

    Object.assign(routing_options.params, route.params);
    routing_options.params.projectRevision =  selectedRevision.value;

    router.push(routing_options);
  }
}

watch(() => selectedRevision.value, changeSelectedRevision, { immediate: false });

</script>

<template>
  <div class="snapshot-view">
    <nav>
      <div>
        <select v-if="project" v-model="selectedRevision">
          <option v-for="rev in project.revisions" :key="rev.name">{{ rev.name }}</option>
        </select>
      </div>
      <input v-model="fileSearchText"/>
      <h3 @click="switchSidebar">Files / Symbols</h3>
      <FileTreeView v-if="myFileTree" v-show="show_file_treeview" :fileTree="myFileTree"></FileTreeView>
      <p v-if="fileSearchProgress >= 0">progress {{ fileSearchProgress }} </p>
      <p v-if="fileSearchText.length && fileSearchCompleted >= 0 && fileSearchResults.length == 0">no file matching pattern</p>
      <ul v-if="fileSearchText.length > 0">
        <SnapshotFileSearchResultItem v-for="result in fileSearchResults" :key="result.element" :matchResult="result"></SnapshotFileSearchResultItem>
      </ul>
      <SnapshotSidebarSymbolTab v-show="show_symbol_treeview"></SnapshotSidebarSymbolTab>
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