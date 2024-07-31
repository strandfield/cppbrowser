<script setup>

import { ref } from 'vue'

defineProps({
  project: {
    type: Object,
    required: true
  }
});

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
}

</script>

<template>
  <div class="item">
    <RouterLink :to="{ name: 'project', params: { projectName: project.name } }">{{ project.name }}</RouterLink> <span @click="toggle">{{ isOpen ? "-" : "+" }}</span>
    <ul v-show="isOpen" v-if="project.revisions.length > 0">
      <li  v-for="rev in project.revisions" :key="rev.name" :revision="rev">
        <RouterLink :to="{ name: 'snapshot', params: { projectName: project.name, projectRevision: rev.name } }">{{ rev.name }}</RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.item .name {
  font-weight: bold;
}
</style>
