<script setup>
import SnapshotsViewProjectGroup from '@/components/SnapshotsViewProjectGroup.vue'

import { snapshots } from '@/state/snapshots';

import { ref, onMounted } from 'vue'

const selection = ref([]);

function onSelectionChanged(newSelection) {
  for (const key in newSelection) {
    if (newSelection[key]) {
      if (!selection.value.find(e => e == key)) {
        selection.value.push(key);
      }
    } else {
      let i = selection.value.findIndex(e => e == key);
      if (i != -1) {
        selection.value.splice(i, 1);
      }
    }
  }
}

function deleteSelection() {
  console.log("requested selection delete for:");
  console.log(selection.value);
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
    <div v-if="selection.length > 0">
      <p>Current selection:</p>
      <ul>
        <li v-for="item in selection" :key="item">
          {{ item }}
        </li>
      </ul>
    </div>
    <div>
      <button type="button" @click="deleteSelection" :disabled="!selection.length">Delete selection</button>
    </div>
    <SnapshotsViewProjectGroup v-for="pro in snapshots.projects" :key="pro.name" :project="pro" @selection-changed="onSelectionChanged"></SnapshotsViewProjectGroup>
  </main>
</template>
