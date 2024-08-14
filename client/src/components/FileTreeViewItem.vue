<script setup>

import { ref, computed, inject } from 'vue'

const props = defineProps({
  treeItem: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    required: false,
    default: 0
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
    <template v-if="depth > 0">
      <div v-for="i in depth" :key="i" class="nested-item-indicator">|</div>
    </template>
    <div class="folder-toggle-block">
      <span  v-if="isDir" @click="toggle">{{ isOpen ? "-" : "+" }}</span>
    </div>
    <div class="item-icon-block">
     
    </div>
    <RouterLink v-if="!isDir" :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: pathParts } }">{{ treeItem.name }}</RouterLink>
    <RouterLink v-if="isDir" :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: pathParts } }">{{ treeItem.name }}</RouterLink>
    <ul v-if="isDir" v-show="isOpen">
      <FileTreeViewItem v-for="entry in treeItem.children" :key="entry.path" :treeItem="entry" :depth="depth+1"></FileTreeViewItem>
    </ul>
  </li>
</template>

<style scoped>
.item .name {
  font-weight: bold;
}

ul {
  list-style: none;
  padding: 0;
}

.nested-item-indicator {
  display: inline-block;
  width: 1em;
  text-align: center;
}

.folder-toggle-block {
  display: inline-block;
  width: 1em;
  text-align: center;
}

.item-icon-block {
  display: inline-block;
  width: 16px;
}
</style>
