<script setup>

import { ref, onMounted, watch } from 'vue'
import $ from "jquery"

const props = defineProps({
  projectName: String,
  projectRevision: String,
  pathParts: Array
});

onMounted(() => {
  console.log(`fileview is now mounted.`);
  fetchFileContent();
});

const sourceCode = ref("");

watch(() => props.projectName + "/" + props.projectRevision + "/" + props.pathParts.join("/"), fetchFileContent, { immediate: false });

function fetchFileContent(sig) {
  console.log(`fetching file ${sig}`);

  $.get(`/api/snapshots/${props.projectName}/${props.projectRevision}/files/${props.pathParts.join("/")}`, (data) => {
      sourceCode.value = data;
  });
}

</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}/{{ pathParts.join("/") }}</h2>
    <pre>{{ sourceCode }}</pre>
  </div>
</template>
