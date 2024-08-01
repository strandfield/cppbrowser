<script setup>
import ProjectItem from '@/components/Home/ProjectItem.vue'

import { snapshots } from '@/state/snapshots';

import { onMounted } from 'vue'

onMounted(() => {
  console.log(`homeview is now mounted.`);
  snapshots.load();
})

</script>

<template>
  <main>
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
    <p>TODO: project [combobox or split button for version], by default go to latest version</p>
    <ProjectItem v-for="pro in snapshots.projects" :key="pro.name" :project="pro"></ProjectItem>
  </main>
</template>
