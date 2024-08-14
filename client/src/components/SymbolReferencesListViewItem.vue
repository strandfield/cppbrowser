<script setup>

import { ref, onMounted, computed } from 'vue'

import $ from 'jquery'

const props = defineProps({
  symbolId: {
    type: String,
    required: true
  },
  projectName: {
    type: String,
    required: true
  },
  projectVersion: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  references: {
    type: Array,
    required: true
  }
});

const lines = ref([]);
const pathParts = computed(() => props.filePath.split("/"));

function setFileContent(data) {
  lines.value = data.split("\n");
}

function fetchFileContent() {
  $.get(`/api/snapshots/${props.projectName}/${props.projectVersion}/files/${props.filePath}`, (data) => {
      setFileContent(data);
  });
}

onMounted(() => {
  fetchFileContent();
});

function getLine(n) {
  return n <= lines.value.length ? lines.value[n-1] : "";
}

function getUrlHashForLine(n) {
  return "#L" + n;
}

</script>

<template>
  <table>
    <tbody>
      <tr v-for="refEntry in references" :key="refEntry.line + ':' + refEntry.col">
        <td><RouterLink :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectVersion, pathParts: pathParts }, hash: getUrlHashForLine(refEntry.line) }">{{ refEntry.line }}</RouterLink></td>
        <td>{{ getLine(refEntry.line) }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>

table {
  font-family: 'Courier New', Courier, monospace;
}
</style>
