<script setup>

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
      symbolTree.value = data;
    }
  });
}

function getIconForSymbol(symbol) {
  if (symbol.kind == 'class') {
    return "/symbol-class.svg";
  } else if (symbol.kind == 'variable') {
    return "/symbol-variable.svg";
  }  else if (symbol.kind == 'field') {
    return "/symbol-field.svg";
  } else if (symbol.kind == 'function' || symbol.kind == 'method' || symbol.kind == 'static-method' || symbol.kind == 'class-method') {
    return "/symbol-method.svg";
  } else if (symbol.kind == 'struct') {
    return "/symbol-structure.svg";
  } else if (symbol.kind == 'enum') {
    return "/symbol-enum.svg";
  } else if (symbol.kind == 'enum-constant') {
    return "/symbol-enum-member.svg";
  } else if (symbol.kind == 'namespace') {
    return "/symbol-namespace.svg";
  }
  return "/symbol-misc.svg";
}

onMounted(() => {
  fetchSymbolTreeRoot();
});

watch(symbolTreeRootFetchUrl, fetchSymbolTreeRoot);

function getPathParts(f) {
  return f.path.split("/");
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
        <tr v-for="child in symbolTree.symbols" :key="child.id">
          <td>
            <div class="d-flex align-items-center">
            <img :src="getIconForSymbol(child)" class="item-icon" />
            <RouterLink
              :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
              {{ child.name }}</RouterLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
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