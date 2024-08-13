<script setup>
import SnapshotsViewProjectGroup from '@/components/SnapshotsViewProjectGroup.vue'

import { snapshots } from '@/state/snapshots';

import $ from 'jquery';

import { reactive, onMounted } from 'vue'

const selection = reactive({
  tree: {},
  list: []
});

function onSelectionChanged(newSelection) {
  selection.tree[newSelection.project] = newSelection.revisions;
  for (const key in newSelection.revisions) {
    let fullname = `${newSelection.project}/${key}`;
    if (newSelection.revisions[key]) {
      if (!selection.list.find(e => e == fullname)) {
        selection.list.push(fullname);
      }
    } else {
      let i = selection.list.findIndex(e => e == fullname);
      if (i != -1) {
        selection.list.splice(i, 1);
      }
    }
  }
}

function deleteSnapshotsFromProject(projectName, revisions) {
  const url = `/api/snapshots/${projectName}?revision=${revisions.join(",")}`;
  console.log(url);
  $.ajax({
    url: url,
    type: 'DELETE',
    success: function (result) {
      snapshots.forceReload();
    }
  });
}

function deleteSelection() {
  console.log("requested selection delete for:");
  console.log(selection.list);
  console.log(selection.tree);
  
  for (const projectName in selection.tree) {
    const project = selection.tree[projectName];
    let selected = [];
    for (const revName in project) {
      if (project[revName]) {
        selected.push(revName);
      }
    }

    if (selected.length > 0) {
        deleteSnapshotsFromProject(projectName, selected);
    }
  }
}

onMounted(() => {
  console.log(`snapshotsview is now mounted.`);
  snapshots.load();
})

</script>

<template>
  <main>
    <h1>Snapshots</h1>
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
    <div v-if="selection.list.length > 0" class="current-selection">
      <p>Current selection:</p>
      <ul>
        <li v-for="item in selection.list" :key="item">
          {{ item }}
        </li>
      </ul>
    </div>
    <div>
      <button type="button" @click="deleteSelection" :disabled="!selection.list.length">Delete selection</button>
    </div>
    <SnapshotsViewProjectGroup v-for="pro in snapshots.projects" :key="pro.name" :project="pro" @selection-changed="onSelectionChanged"></SnapshotsViewProjectGroup>
  </main>
</template>

<style scoped>
.current-selection {
  float: right;
}
</style>