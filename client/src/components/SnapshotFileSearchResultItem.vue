<script setup>

import { ref, computed, inject } from 'vue'

const props = defineProps({
  matchResult: {
    type: Object,
    required: true
  }
});

const projectName = inject('projectName');
const projectRevision = inject('projectRevision');

function splitPath(path) {
  return path.split("/");
}

</script>

<template>
  <li>
    <RouterLink
      :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: splitPath(matchResult.element) } }">
      {{ matchResult.element }}</RouterLink> ({{ matchResult.score }})
  </li>
</template>

<style scoped>

</style>
