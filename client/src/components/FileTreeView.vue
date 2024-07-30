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
