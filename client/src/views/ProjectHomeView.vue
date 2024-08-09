<script setup>


import { ref, inject, onMounted, watch, computed } from 'vue'

import $ from 'jquery'

const props = defineProps({
  projectName: String,
  projectRevision: String
});

const snapshotFileTree = inject('snapshotFileTree');

const symbolTree = ref(null);

const symbolTreeRootFetchUrl = computed(() => `/api/snapshots/${props.projectName}/${props.projectRevision}/symbols/tree`);

function fetchSymbolTreeRoot() {
  symbolTree.value = null;

  $.get(symbolTreeRootFetchUrl.value, (data) => {
    if (data.success) {
      symbolTree.value = data;
    }
  });
}

onMounted(() => {
  fetchSymbolTreeRoot();
});

watch(symbolTreeRootFetchUrl, fetchSymbolTreeRoot);

function getPathParts(f) {
  return f.path.split("/");
}

</script>

<template>
  <div>
    <h1>{{ projectName }}/{{ projectRevision }}</h1>
    <p>This is the snapshot for {{ projectName }}/{{ projectRevision }}!</p>
    <p>
      TODO: add mixed symbol/file search bar
    </p>
    <h2>Files</h2>
    <table v-if="snapshotFileTree">
      <tbody>
        <tr v-for="f in snapshotFileTree.children" :key="f.path">
          <td v-if="f.type == 'file'">
            <RouterLink :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">{{ f.name }}</RouterLink>
          </td>
          <td v-if="f.type == 'dir'">
            <RouterLink :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">{{ f.name }}</RouterLink>
          </td>
        </tr>
      </tbody>
    </table>
    <h2>Symbols</h2>
    <table v-if="symbolTree">
      <tbody>
        <tr v-for="child in symbolTree.symbols" :key="child.id">
          <td>
            <RouterLink :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">{{ child.name }}</RouterLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
