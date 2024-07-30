<script setup>

import { ref, computed, inject } from 'vue'

const props = defineProps({
  treeItem: {
    type: Object,
    required: true
  }
});

const isDir = computed(() => {
  return props.treeItem.type == 'dir';
})

const pathParts = computed(() => {
  return props.treeItem.path.split("/");
})

const isOpen = ref(false);

const projectName = inject('projectName');
const projectRevision = inject('projectRevision');

function toggle() {
  isOpen.value = !isOpen.value;
}

</script>

<template>
  <li class="item">
    <span  v-if="isDir" @click="toggle">{{ isOpen ? "-" : "+" }}</span>
    <RouterLink v-if="!isDir" :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: pathParts } }">{{ treeItem.name }}</RouterLink>
    <span v-if="isDir">{{ treeItem.name }}</span>
    <ul v-if="isDir" v-show="isOpen">
      <FileTreeViewItem v-for="entry in treeItem.children" :key="entry.path" :treeItem="entry"></FileTreeViewItem>
    </ul>
  </li>
</template>

<style scoped>
.item .name {
  font-weight: bold;
}
</style>
