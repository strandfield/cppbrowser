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
    <div class="item-content">
      <template v-if="depth > 0">
        <div v-for="i in depth" :key="i" class="indent"><div class="nested-item-indicator"></div></div>
        <!-- <div v-for="i in depth" :key="i" class="nested-item-indicator">|</div> -->
      </template>
      <div class="folder-toggle-block">
        <img v-if="isDir" @click="toggle" :src="isOpen ? '/chevron-down.svg' : '/chevron-right.svg'"
          class="toggle-image" />
      </div>
      <div class="item-icon-block">
        <img v-if="isDir" :src="isOpen ? '/folder-opened.svg' : '/folder.svg'" class="folder-image"/>
        <img v-if="!isDir" src="/file.svg" class="folder-image"/>
      </div>
      <RouterLink v-if="!isDir"
        :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: pathParts } }" class="name">
        {{ treeItem.name }}</RouterLink>
      <RouterLink v-if="isDir"
        :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: pathParts } }" class="name">
        {{
        treeItem.name }}</RouterLink>
    </div>
    <ul v-if="isDir" v-show="isOpen">
      <FileTreeViewItem v-for="entry in treeItem.children" :key="entry.path" :treeItem="entry" :depth="depth + 1">
      </FileTreeViewItem>
    </ul>
  </li>
</template>

<style scoped>

.item {
  
}

.item-content {
  display: flex;
  align-items: center;
}

.item-content .name {
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

ul {
  list-style: none;
  padding: 0;
}

.indent {
  display: inline-block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.nested-item-indicator {
  margin-left: 10px;
  width: 1px;
  height: 22px;
  background-color: lightgrey;
  border-right: 1px solid lightgrey;
}

.folder-toggle-block {
  display: inline-block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.toggle-image {
  display: block;
  margin-left: 3px;
  margin-top: 4px;
}

.folder-image {
  margin-left: 3px;
  margin-top: 4px; 
}

.item-icon-block {
  display: inline-block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

</style>
