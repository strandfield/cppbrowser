<script setup>

import SymbolReferencesListViewItem from './SymbolReferencesListViewItem.vue';

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

const symbolReferencesByFile = ref([]);

const loaded = ref(false);
const loading = ref(false);

function fetchData() {
  if (!props.projectName || !props.projectVersion) {
    return;
  }

  $.get(`/api/symbols/${props.symbolId}/references?project=${props.projectName}&version=${props.projectVersion}`, (data) => {
            if (data.success) {
              if (data.result[0].project == props.projectName && data.result[0].versions[0].version == props.projectVersion) {
                symbolReferencesByFile.value = data.result[0].versions[0].result;
              }
            }

            loading.value = false;
            loaded.value = true;
        });
  
  symbolReferencesByFile.value = [];
  loading.value = true;
}

onMounted(() => {
  fetchData();
});

watch(() => props.symbolId, fetchData);
watch(() => props.projectName, fetchData);
watch(() => props.projectVersion, fetchData);

function formattedRefCountMessage(n) {
  return n > 1 ? `${n} references` : `1 reference`;
}

</script>

<template>
  <template v-for="fileEntry in symbolReferencesByFile" :key="fileEntry.filePath">
    <h4>{{ fileEntry.filePath }} ({{ formattedRefCountMessage(fileEntry.references.length) }})</h4>
    <SymbolReferencesListViewItem :symbolId="symbolId" :projectName="projectName" :projectVersion="projectVersion"
      :filePath="fileEntry.filePath" :references="fileEntry.references"></SymbolReferencesListViewItem>
  </template>
  <p v-if="loading">Loading...</p>
  <p v-if="loaded && symbolReferencesByFile.length == 0">The symbol isn't referenced in this version of {{ projectName }}.</p>
</template>

<style scoped>

</style>
