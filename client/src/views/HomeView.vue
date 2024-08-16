<script setup>

import { snapshots } from '@/state/snapshots';

import { onMounted } from 'vue'

function getProjectLatestRevision(project) {
  return project.revisions[0].name;
}

onMounted(() => {
  console.log(`homeview is now mounted.`);
  snapshots.load();
})

</script>

<template>
  <main>
    <h1>Projects</h1>
    <p v-if="snapshots.state == 'loading'">
      I am loading
    </p>
    <p v-if="snapshots.state == 'error'">
      I am error
    </p>
    <h2 v-for="pro in snapshots.projects" :key="pro.name">
      <RouterLink
        :to="{ name: 'snapshot', params: { projectName: pro.name, projectRevision: getProjectLatestRevision(pro)} }">{{ pro.name }}</RouterLink>
    </h2>
  </main>
</template>
