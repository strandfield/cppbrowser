<script setup>

import DeclarationViewerElement from './DeclarationViewerElement.vue';

import { ref, onMounted, watch } from 'vue'

import $ from 'jquery'

const props = defineProps({
  symbolId: {
    type: String,
    required: true
  },
  projectName: {
    type: String,
    required: true
  },
  projectVersion: {
    type: String,
    required: true
  }
});

const symbolDeclarations = ref([]);

const loaded = ref(false);
const loading = ref(false);

defineExpose({
  loaded, 
  loading,
  symbolDeclarations
});

function fetchData() {
  if (!props.projectName || !props.projectVersion) {
    return;
  }

  const projectName = props.projectName;
  const projectVersion = props.projectVersion;
  const symbolId = props.symbolId;

  $.get(`/api/snapshots/${projectName}/${projectVersion}/symbols/${symbolId}/declarations`, (data) => {
            if (data.success) {
              if (projectName == props.projectName && projectVersion == props.projectVersion && symbolId == props.symbolId) {
                symbolDeclarations.value = data.declarations;
              }
            }

            loading.value = false;
            loaded.value = true;
        });
  
  symbolDeclarations.value = [];
  loading.value = true;
}

onMounted(() => {
  fetchData();
});

watch(() => props.symbolId, fetchData);
watch(() => props.projectName, fetchData);
watch(() => props.projectVersion, fetchData);

</script>

<template>
  <DeclarationViewerElement v-for="decl in symbolDeclarations" :projectName="projectName" :projectRevision="projectVersion" :declarationObject="decl">
  </DeclarationViewerElement>
  <p v-if="loading">Loading...</p>
</template>

<style scoped>

</style>
