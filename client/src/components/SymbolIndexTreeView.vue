<script setup>
import SymbolIndexTreeViewItem from './SymbolIndexTreeViewItem.vue'

defineProps({
  symbolTree: Object
});

</script>

<template>
  <ul v-if="symbolTree">
    <SymbolIndexTreeViewItem v-for="child in symbolTree.children" :key="child.id" :treeItem="child"></SymbolIndexTreeViewItem>
  </ul>
</template>
