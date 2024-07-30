<script setup>
import ProjectItem from './TreeView/ProjectItem.vue'

import { snapshots } from '@/state/snapshots';

import { onMounted } from 'vue'

onMounted(() => {
  console.log(`treeview is now mounted.`);
  snapshots.load();
})

</script>

<template>
  <template v-if="snapshots.state == 'loading'">
    <p>
      I am loading
    </p>
  </template>
  <template v-if="snapshots.state == 'error'">
    <p>
      I am error
    </p>
  </template>
  <ul class="treeview" v-if="snapshots.state == 'loaded'">
    <ProjectItem v-for="pro in snapshots.projects" :key="pro.name" :project="pro"></ProjectItem>
  </ul>
</template>
