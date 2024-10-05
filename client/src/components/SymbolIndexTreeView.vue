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

<style scoped>
ul {
  list-style: none;
  padding: 0;
  line-height: normal;
  font-size: 15px;
  font-weight: normal;
}
</style>