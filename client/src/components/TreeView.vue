<script setup>
import ProjectItem from './TreeView/ProjectItem.vue'

import { ref, onMounted } from 'vue'
import $ from "jquery"

const projects = ref([]);
const state = ref('error');

onMounted(() => {
  console.log(`treeview is now mounted.`);
  state.value = 'loading';

  // $.ajax({
  //   url: "/api/snapshots"
  // }) .done(function( data ) {
  //     console.log(JSON.stringify(data));
    
  // });

  $.get("/api/snapshots", function(data){
    let project_map = new Map();
    for (const snap of data) {
      let p = project_map.has(snap.project) ? project_map.get(snap.project) : null;
      if (!p) {
        p = {
          name: snap.project,
          revisions: []
        };
        project_map.set(snap.project, p);
      }

      p.revisions.push({
        projectName: snap.project,
        name: snap.name
      });
    }

    let project_list = [];
    project_map.forEach(value => {
      project_list.push(value);
    });
    project_list.sort((a,b) => a.name.localeCompare(b.name));

    projects.value = project_list;
    state.value = 'loaded';
  });
})

</script>

<template>
  <template v-if="state == 'loading'">
    <p>
      I am loading
    </p>
  </template>
  <template v-if="state == 'error'">
    <p>
      I am error
    </p>
  </template>
  <ul class="treeview" v-if="state == 'loaded'">
    <ProjectItem v-for="pro in projects" :key="pro.name" :project="pro"></ProjectItem>
  </ul>
</template>
