<script setup>

import SymbolReferencesListViewItem from './SymbolReferencesListViewItem.vue';

import { ref, onMounted, watch, provide } from 'vue'

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
const symbolReferencesContext = ref(null);

provide('symbolReferencesContext', symbolReferencesContext);

const loaded = ref(false);
const loading = ref(false);

function fetchData() {
  if (!props.projectName || !props.projectVersion) {
    return;
  }

  //const url = `/api/symbols/${props.symbolId}/references?project=${props.projectName}&version=${props.projectVersion}`;
  // $.get(url, (data) => {
  //           if (data.success) {
  //             if (data.result[0].project == props.projectName && data.result[0].versions[0].version == props.projectVersion) {
  //               let list =  data.result[0].versions[0].result;
  //               // TODO: rework sorting function so that header file (".h") appear before
  //               // the associated source file (".cpp").
  //               list.sort((a,b)=> a.filePath.localeCompare(b.filePath));
  //               symbolReferencesByFile.value = list;
  //             }
  //           }

  //           loading.value = false;
  //           loaded.value = true;
  //       });

  const url = `/api/snapshots/${props.projectName}/${props.projectVersion}/symbols/${props.symbolId}/references`;
  $.get(url, (data) => {
            if (data.success) {
              symbolReferencesContext.value = data.context;
              // TODO: check that the data matches with current props.projectVersion & props.projectName
              let list =  data.references;
                // TODO: rework sorting function so that header file (".h") appear before
                // the associated source file (".cpp").
                list.sort((a,b)=> a.filePath.localeCompare(b.filePath));
                symbolReferencesByFile.value = list;
            }

            loading.value = false;
            loaded.value = true;
        });

  
  symbolReferencesByFile.value = [];
  symbolReferencesContext.value = {};
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
