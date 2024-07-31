<script setup>

import FileTreeView from '@/components/FileTreeView.vue';

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


const treeview_mode = ref('files');

const show_file_treeview = computed(() => {
  return treeview_mode.value == 'files';
})

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

watch(() => props.projectName + "/" + props.projectRevision, fetchSnapshotFiles, { immediate: false });

</script>

<template>
  <div class="snapshot-view">
    <nav>
      <div>TODO: version combobox</div>
      <h3>Files</h3>
      <FileTreeView v-if="show_file_treeview && myFileTree" :fileTree="myFileTree"></FileTreeView>
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