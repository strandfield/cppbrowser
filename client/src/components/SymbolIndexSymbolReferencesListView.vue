<script setup>
import SymbolIndexSymbolReferencesListViewItem from './SymbolIndexSymbolReferencesListViewItem.vue'

import { inject } from 'vue'

defineProps({
  symbolId: {
    type: String,
    required: true
  }
});

const symbolIndexSources = inject('symbolIndexSources');

</script>

<template>
  <SymbolIndexSymbolReferencesListViewItem v-for="source in symbolIndexSources" :key="source.project" :symbolId="symbolId" :projectName="source.project" :projectVersions="source.versions"></SymbolIndexSymbolReferencesListViewItem>
</template>
