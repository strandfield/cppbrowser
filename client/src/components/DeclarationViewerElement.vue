<script setup>

import CodeViewerElement from '@/components/CodeViewerElement.vue';

import { ref, computed } from 'vue'

const visible = ref(true);

const props = defineProps({
  projectName: String,
  projectRevision: String,
  declarationObject: Object
});

const pathPaths = computed(() => props.declarationObject.filePath.split("/"));

function getPathParts(path) {
  return path.split("/");
}

function toggle() {
  visible.value = !visible.value;
}

function getLinkParams() {
  return{ projectName: props.projectName, projectRevision: props.projectVersion, pathParts: pathPaths.value };
}

function getUrlHash() {
  return "#L" + props.declarationObject.sourceRange.begin.line;
}

</script>

<template>
  <div class="decl-container">
    <div class="header d-flex">
      <img @click="toggle" :src="visible ? '/chevron-down.svg' : '/chevron-right.svg'"
          class="toggle-image" />
      <p>{{ declarationObject.isDef ? "Defined" : "Declared" }} 
        in <RouterLink :to="{ name: 'file', params: getLinkParams() }">{{ declarationObject.filePath }}</RouterLink>  
        @ line <RouterLink :to="{ name: 'file', params: getLinkParams(), hash: getUrlHash() }">{{ declarationObject.sourceRange.begin.line }}</RouterLink></p>
    </div>
    <CodeViewerElement v-show="visible" :projectName="projectName" :projectRevision="projectRevision" :pathParts="getPathParts(declarationObject.filePath)" 
      :startLine="declarationObject.sourceRange.begin.line" :endLine="declarationObject.sourceRange.end.line"></CodeViewerElement>
  </div>
</template>

<style scoped>
.decl-container {
  border: 1px solid lightgrey;
  border-radius: 4px;
  margin-top: 1em;
}

.header {
  padding: 0.5rem;
  background-color: lightgrey;
}

.toggle-image {
  width: 22px;
  height: 22px;
}

</style>