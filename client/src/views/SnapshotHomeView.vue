<script setup>


import { ref, inject, onMounted, watch, computed } from 'vue'

import $ from 'jquery'

const props = defineProps({
  projectName: String,
  projectRevision: String
});

const snapshotFileTree = inject('snapshotFileTree');

const symbolTree = ref(null);

const fetchUrl = computed(() => `/api/snapshots/${props.projectName}/${props.projectRevision}/symbols/tree`);

function fetchTreeRoot() {
  symbolTree.value = null;

  $.get(fetchUrl.value, (data) => {
    if (data.success) {
      symbolTree.value = data;
    }
  });
}

onMounted(() => {
  fetchTreeRoot();
});

watch(fetchUrl, fetchTreeRoot);

function getPathParts(f) {
  return f.path.split("/");
}

</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}</h2>
    <p>This is the snapshot for {{ projectName }}/{{ projectRevision }}!</p>
    <h3>Files</h3>
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
    <h3>Symbols</h3>
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
