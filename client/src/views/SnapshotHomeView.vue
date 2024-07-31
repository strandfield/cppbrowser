<script setup>


import { inject } from 'vue'

defineProps({
  projectName: String,
  projectRevision: String
});

const snapshotFileTree = inject('snapshotFileTree');

function getPathParts(f) {
  return f.path.split("/");
}

</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}</h2>
    <p>This is the snapshot for {{ projectName }}/{{ projectRevision }}!</p>
    <h3>Files</h3>
    <table v-if="snapshotFileTree">
      <tbody>
        <tr v-for="f in snapshotFileTree.children" :key="f.path">
          <td v-if="f.type == 'file'">
            <RouterLink :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">{{ f.name }}</RouterLink>
          </td>
          <td v-if="f.type == 'dir'">
            <RouterLink :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">{{ f.name }}</RouterLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
