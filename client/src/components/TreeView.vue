<script setup>
import ProjectItem from './TreeView/ProjectItem.vue'

import { snapshots } from '@/state/snapshots';

import { ref, onMounted } from 'vue'

onMounted(() => {
  console.log(`treeview is now mounted.`);

  // $.ajax({
  //   url: "/api/snapshots"
  // }) .done(function( data ) {
  //     console.log(JSON.stringify(data));
    
  // });

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
