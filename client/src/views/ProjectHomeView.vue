<script setup>

import SymbolIcon from '@/components/icons/SymbolIcon.vue';

import { symbol_isFromProject, symbol_isMacro, macro_isUsedAsHeaderGuard } from '@cppbrowser/snapshot-tools'

import { ref, inject, onMounted, watch, computed } from 'vue'

import $ from 'jquery'

const props = defineProps({
  projectName: String,
  projectRevision: String
});

const snapshotFileTree = inject('snapshotFileTree');

const symbolTree = ref(null);

const symbolTreeRootFetchUrl = computed(() => `/api/snapshots/${props.projectName}/${props.projectRevision}/symbols/tree`);

function fetchSymbolTreeRoot() {
  symbolTree.value = null;

  $.get(symbolTreeRootFetchUrl.value, (data) => {
    if (data.success) {
      data.symbols = data.symbols.sort((a,b) => a.name.localeCompare(b.name));
      symbolTree.value = data;
    }
  });
}

onMounted(() => {
  fetchSymbolTreeRoot();
});

watch(symbolTreeRootFetchUrl, fetchSymbolTreeRoot);

function getPathParts(f) {
  return f.path.split("/");
}

function shouldDisplaySymbol(sym) {
  return symbol_isFromProject(sym)
    && (!symbol_isMacro(sym) || !macro_isUsedAsHeaderGuard(sym));
}

</script>

<template>
  <div class="centered-content">
    <h1>{{ projectName }}/{{ projectRevision }}</h1>
    <h2>Files</h2>
    <table v-if="snapshotFileTree">
      <tbody>
        <tr v-for="f in snapshotFileTree.children" :key="f.path">
          <td v-if="f.type == 'file'">
            <div class="d-flex align-items-center">
              <img src="/file.svg" class="item-icon" />
              <RouterLink
                :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">
                {{ f.name }}</RouterLink>
            </div>
          </td>
          <td v-if="f.type == 'dir'">
            <div class="d-flex align-items-center">
              <img src="/folder.svg" class="item-icon" />
              <RouterLink
                :to="{ name: 'dir', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(f) } }">
                {{ f.name }}</RouterLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <h2>Symbols</h2>
    <table v-if="symbolTree">
      <tbody>
        <tr v-for="child in symbolTree.symbols" :key="child.id" v-show="shouldDisplaySymbol(child)">
          <td>
            <div class="d-flex align-items-center">
            <SymbolIcon :symbolKind="child.kind" class="item-icon"></SymbolIcon>
            <RouterLink
              :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
              {{ child.name }}</RouterLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <!--h2>TODO: diagnostics</h2-->
  </div>
</template>

<style scoped>

table {
  margin-top: 1em;
  margin-bottom: 2em;
  border: 1px solid lightgray;
  width: 100%;
  border-collapse: collapse;
}

td {
  padding: 0.4em 0;
  border: 1px solid lightgrey;
  padding-left: 1em;
}

.item-icon {
  margin-right: 0.5em;
}

</style>