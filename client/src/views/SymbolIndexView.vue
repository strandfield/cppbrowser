<script setup>

import SymbolIndexTreeView from "@/components/SymbolIndexTreeView.vue"

import { ref, onMounted, provide } from 'vue'

import $ from 'jquery'

const symbolIndexSources = ref([]);
const symbolList = ref([]);
const symbolTree = ref(null);

provide('symbolIndexSources', symbolIndexSources);
provide('symbolList', symbolList);
provide('symbolTree', symbolTree);

function fetchSymbolIndexSources() {
  $.get("/api/symbols/snapshots", (data) => {
            if (data.success) {
              symbolIndexSources.value = data.source;
            }
        });
}

function fetchSymbolTree() {
  $.get("/api/symbols/tree", (data) => {
            if (data.success) {
              symbolTree.value = data;
            }
        });
}

function fetchSymbolList() {
  $.get("/api/symbols", (data) => {
            if (data.success) {
              symbolList.value = data;
            }
        });
}

onMounted(() => {
  console.log(`SymbolIndexView is now mounted.`);
  fetchSymbolIndexSources();
  fetchSymbolTree();
  fetchSymbolList();
});

</script>

<template>
  <div class="main-view">
    <nav>
      <h3>Symbols</h3>
      <SymbolIndexTreeView :symbolTree="symbolTree"></SymbolIndexTreeView>
    </nav>
    <div>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.main-view {
  display: flex;
}
</style>