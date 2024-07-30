<script setup>

import FileTreeView from '@/components/FileTreeView.vue';

import { files } from '@/state/files';

import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  projectName: String,
  projectRevision: String
});

const myfiles = ref([]);
const myFileTree = ref(null);

const file_tree_view = ref(false);

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

onMounted(() => {
  console.log(`snapshotview is now mounted.`);
  fetchSnapshotFiles();
});

watch(() => props.projectName, fetchSnapshotFiles, { immediate: false });
watch(() => props.projectRevision, fetchSnapshotFiles, { immediate: false });

function switchFileView() {
  file_tree_view.value = !file_tree_view.value;
}

</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}</h2>
    <h3 @click="switchFileView()">Files</h3>
    <table v-if="myfiles && !file_tree_view">
      <tbody>
      <tr v-for="f in myfiles" :key="f">
        <td>{{ f }}</td>
      </tr>
      </tbody>
    </table>
    <FileTreeView v-if="myfiles && file_tree_view" :fileTree="myFileTree"></FileTreeView>
  </div>
</template>
