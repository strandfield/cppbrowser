<script setup>
import SnapshotSymbolTreeViewItem from './SnapshotSymbolTreeViewItem.vue'

import { ref, toRef, onMounted, provide, watch } from 'vue'

import $ from 'jquery'

const props = defineProps({
  projectName: String,
  projectRevision: String
});

provide('projectName', props.projectName);
provide('projectRevision', toRef(() => props.projectRevision));

const symbolTree = ref(null);

function fetchTreeRoot() {
  symbolTree.value = null;

  $.get(`/api/snapshots/${props.projectName}/${props.projectRevision}/symbols/tree`, (data) => {
    if (data.success) {
      data.symbols = data.symbols.sort((a,b) => a.name.localeCompare(b.name));
      symbolTree.value = data;
    }
  });
}

watch(() => props.projectName, fetchTreeRoot);
watch(() => props.projectRevision, fetchTreeRoot);

onMounted(() => {
  fetchTreeRoot();
});

</script>

<template>
  <ul v-if="symbolTree">
    <SnapshotSymbolTreeViewItem v-for="child in symbolTree.symbols" :key="child.id" :treeItem="child"></SnapshotSymbolTreeViewItem>
  </ul>
</template>

<style scoped>
ul {
  list-style: none;
  padding: 0;
  line-height: normal;
  font-size: 15px;
  font-weight: normal;
}
</style>