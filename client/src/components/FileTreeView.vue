<script setup>
import FileTreeViewItem from './FileTreeViewItem.vue'

defineProps({
  fileTree: {
    type: Object,
    required: true
  }
});

</script>

<template>
  <ul>
    <FileTreeViewItem v-for="entry in fileTree.children" :key="entry.path" :treeItem="entry"></FileTreeViewItem>
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
