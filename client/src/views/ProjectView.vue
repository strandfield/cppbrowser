<script setup>

import { snapshots } from '@/state/snapshots';

import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  projectName: String
});

const project = ref(null);

onMounted(() => {
  console.log(`projectview is now mounted.`);
  snapshots.load(); // TODO: ajouter un callback pour appeler fetchProjectInfo()
});

function fetchProjectInfo(projectName) {
  console.log("fetching info for "+projectName);
  project.value = snapshots.getProject(projectName);
}

watch(() => props.projectName, fetchProjectInfo, { immediate: true });

function removeSnapshot(name) {
  console.log("requested remove snapshot: " + name);
}

</script>

<template>
  <div>
    <h2>{{ projectName }}</h2>
    <h3>Snapshots</h3>
    <table v-if="project">
      <tbody>
      <tr v-for="snapshot in project.revisions" :key="snapshot.name">
        <td>{{ snapshot.name }}</td>
        <td><RouterLink :to="{ name: 'snapshot', params: { projectName: project.name, projectRevision: snapshot.name } }">{{ snapshot.name }}</RouterLink></td>
        <td><a :href="`/download/${projectName}/${ snapshot.name }`">Download</a></td>
        <td @click="removeSnapshot(snapshot.name)">Remove</td>
      </tr>
      </tbody>
    </table>
  </div>
</template>
