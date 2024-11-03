<script setup>

import SymbolReferencesListViewItem from './SymbolReferencesListViewItem.vue';

import { symbolReference_isCall, symbolReference_isAddressOf, symbolReference_isRead, symbolReference_isWrite } from '@cppbrowser/snapshot-tools';

import { ref, onMounted, watch, provide, reactive, toRef } from 'vue'

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

provide('symbolId', toRef(props, 'symbolId'));
provide('projectName', toRef(props, 'projectName'));
provide('projectVersion', toRef(props, 'projectVersion'));

const symbolReferencesByFile = ref([]);
const symbolReferencesContext = ref(null);
provide('symbolReferencesContext', symbolReferencesContext);

const filters = reactive({
  read: { count: 0, checked: true },
  write: { count: 0, checked: true },
  call: { count: 0, checked: true },
  addressOf: { count: 0, checked: true },
  other: { count: 0, checked: true },
});
provide('listViewFilters', filters);

const loaded = ref(false);
const loading = ref(false);


function writeCounters(list) {
  for (let fileEntry of list) {
    let read = 0, write = 0, call = 0, addressOf = 0, other = 0;
    for (const refEntry of fileEntry.references) {
      if (symbolReference_isRead(refEntry)) {
        read += 1;
      } else if (symbolReference_isWrite(refEntry)) {
        write += 1;
      } else if (symbolReference_isCall(refEntry)) {
        call += 1;
      } else if (symbolReference_isAddressOf(refEntry)) {
        addressOf += 1;
      } else {
        other += 1;
      }
    }

    fileEntry.counters = {
      read: read,
      write: write,
      call: call,
      addressOf: addressOf,
      other: other
    };
  }
}

function updateCounters() {
  let read = 0, write = 0, call = 0, addressOf = 0, other = 0;
  for (const fileEntry of symbolReferencesByFile.value) {
    read += fileEntry.counters.read;
    write += fileEntry.counters.write;
    call += fileEntry.counters.call;
    addressOf += fileEntry.counters.addressOf;
    other += fileEntry.counters.other;
  }

  filters.read.count = read;
  filters.write.count = write;
  filters.call.count = call;
  filters.addressOf.count = addressOf;
  filters.other.count = other;
}

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
                writeCounters(list);
                symbolReferencesByFile.value = list;
                updateCounters();
            }

            loading.value = false;
            loaded.value = true;
        });

  
  symbolReferencesByFile.value = [];
  symbolReferencesContext.value = null;
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
  <div v-if="loaded && symbolReferencesByFile.length > 0" class="d-flex">
    <div class="filterItem" v-show="filters.read.count > 0"><input type="checkbox" name="read" v-model="filters.read.checked"/><label for="read">Read ({{ filters.read.count }})</label></div>
    <div class="filterItem" v-show="filters.write.count > 0"><input type="checkbox" name="write" v-model="filters.write.checked"/><label for="write">Write ({{ filters.write.count }})</label></div>
    <div class="filterItem" v-show="filters.call.count > 0"><input type="checkbox" name="call" v-model="filters.call.checked"/><label for="call">Call ({{ filters.call.count }})</label></div>
    <div class="filterItem" v-show="filters.addressOf.count > 0"><input type="checkbox" name="addressOf" v-model="filters.addressOf.checked"/><label for="addressOf">Address Of ({{ filters.addressOf.count }})</label></div>
    <div class="filterItem" v-show="filters.other.count > 0"><input type="checkbox" name="other" v-model="filters.other.checked"/><label for="other">Others ({{ filters.other.count }})</label></div>
  </div>
  <template v-for="fileEntry in symbolReferencesByFile" :key="fileEntry.filePath">
    <SymbolReferencesListViewItem :fileEntry="fileEntry"></SymbolReferencesListViewItem>
  </template>
  <p v-if="loading">Loading...</p>
  <p v-if="loaded && symbolReferencesByFile.length == 0">The symbol isn't referenced in this version of {{ projectName }}.</p>
</template>

<style scoped>

.filterItem {
  margin-right: 1em;
}

.filterItem label {
  padding-left: 0.25em;
}

</style>
