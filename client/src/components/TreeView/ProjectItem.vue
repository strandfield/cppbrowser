<script setup>

import SnapshotItem from './SnapshotItem.vue';

import { ref } from 'vue'

const props = defineProps({
  project: {
    type: Object,
    required: true
  }
});

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
}

function select() {
  console.log(props.project.name);
}

</script>

<template>
  <li class="item">
    <span @click="toggle">{{ isOpen ? "-" : "+" }}</span><span class="name" @click="select">{{ project.name }}</span>
    <ul v-show="isOpen" v-if="project.revisions.length > 0">
      <SnapshotItem v-for="rev in project.revisions" :key="rev.name" :revision="rev"></SnapshotItem>
    </ul>
  </li>
</template>

<style scoped>
.item .name {
  font-weight: bold;
}
</style>
