<script setup>

import { files } from '@/state/files';

import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  projectName: String,
  projectRevision: String
});

const myfiles = ref([]);

function receiveSnapshotFiles(projectName, projectRevision, data) {
  if (projectName == props.projectName && projectRevision == props.projectRevision) {
    myfiles.value = data.files;
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

</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}</h2>
    <h3>Files</h3>
    <table v-if="myfiles">
      <tbody>
      <tr v-for="f in myfiles" :key="f">
        <td>{{ f }}</td>
      </tr>
      </tbody>
    </table>
  </div>
</template>
