<script setup>

import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  projectName: String
});

onMounted(() => {
  console.log(`projectview is now mounted.`);
});

function fetchProjectInfo(projectName) {
  console.log("fetching info for "+projectName);
}

watch(() => props.projectName, fetchProjectInfo, { immediate: true })

</script>

<template>
  <p>
    This is {{ projectName }}!
    </p>
</template>
