<script setup>

import { ref, onMounted, watch, inject } from 'vue'

const props = defineProps({
  projectName: String,
  projectRevision: String,
  pathParts: Array
});

const snapshotFileTree = inject('snapshotFileTree');
const snapshotFileTreeItem = ref(null);

onMounted(() => {
  console.log(`directoryview is now mounted.`);
  fetchDirContent();
});

watch(() => props.projectName + "/" + props.projectRevision + "/" + props.pathParts.join("/"), fetchDirContent, { immediate: false });
watch(() => snapshotFileTree, fetchDirContent, { immediate: false });

function fetchDirContent() {
  let full_path = `${props.projectName}/${props.projectRevision}/files/${props.pathParts.join("/")}`;
  console.log("fetching dir content " + full_path);

  let node = snapshotFileTree.value;

  let parts = [...props.pathParts].reverse();

  while (node && parts.length > 0) {
    const p = parts.pop();
    node = node.children.find(n => n.name == p);
  }

  snapshotFileTreeItem.value = node;
}

function getPathParts(f) {
  return f.path.split("/");
}

</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}</h2>
    <p>so me that breadcrumb</p>
    <h3>Files</h3>
    <table v-if="snapshotFileTreeItem">
      <tbody>
        <tr v-for="f in snapshotFileTreeItem.children" :key="f.path">
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
