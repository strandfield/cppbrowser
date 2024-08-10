<script setup>

import { snapshots } from '@/state/snapshots';

import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  projectName: String
});

const project = ref(null);

onMounted(() => {
  if (snapshots.state == 'loaded')  {
    fetchProjectInfo();
  } else {
    snapshots.load();
  }
});

function fetchProjectInfo(projectName = null) {
  if (!projectName) {
    projectName = props.projectName;
  }
  console.log("fetching info for "+projectName);
  if (snapshots.state == 'loaded') {
    project.value = snapshots.getProject(projectName);
  }
}

function onSnapshotsStateChanged(state) {
  if (state == 'loaded') {
    fetchProjectInfo()
  }
}

watch(() => props.projectName, fetchProjectInfo, { immediate: false });
watch(() => snapshots.state, onSnapshotsStateChanged, { immediate: false });

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
