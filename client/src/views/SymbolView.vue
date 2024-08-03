<script setup>


import { CodeViewer } from '@cppbrowser/codebrowser'

import { ref, onMounted, watch, inject } from 'vue'
import { useRouter } from 'vue-router'

import $ from 'jquery'

const props = defineProps({
  projectName: String,
  projectRevision: String,
  symbolId: String
});

const router = useRouter();


function fetchSymbolInfo() {
  console.log(`fetching symbol info for ${props.symbolId}`);
}

onMounted(() => {
  console.log(`symbolview is now mounted.`);
  fetchSymbolInfo();
});

watch(() => props.projectName + "/" + props.projectRevision + "/" + props.symbolId, fetchSymbolInfo, { immediate: false });



</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}/#{{ symbolId }}</h2>
    <p>This is page for symbol #{{ symbolId }}</p>
  </div>
</template>
