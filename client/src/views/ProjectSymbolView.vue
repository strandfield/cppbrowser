<script setup>


import SnapshotSidebarSymbolTab from '@/components/SnapshotSidebarSymbolTab.vue'

import { ref, onMounted, watch, computed, provide, toRef } from 'vue'

import $ from 'jquery'

const props = defineProps({
  projectName: String,
  projectRevision: String,
  symbolId: String
});

provide('projectRevision', toRef(() => props.projectRevision));

const symbol = ref(null);

const isClass = computed(() => symbol.value?.kind == 'class' || symbol.value?.kind == 'struct');
const isNamespace = computed(() => symbol.value?.kind == 'namespace');

function fetchSymbolInfo() {
  console.log(`fetching symbol info for ${props.symbolId}`);

  $.get(`/api/snapshots/${props.projectName}/${props.projectRevision}/symbols/${props.symbolId}`, (data) => {
      if (data.success) {
        console.log(data);
        symbol.value = data.symbol;
      } else {
        console.error(data);
      }
  });
}

watch(() => props.projectName + "/" + props.projectRevision + "/" + props.symbolId, fetchSymbolInfo, { immediate: false });

onMounted(() => {
  console.log(`symbolview is now mounted.`);
  fetchSymbolInfo();
});

function getPathParts(path) {
  return path.split("/");
}

function getPathPartsForDef(def) {
  return def.filePath.split("/");
}

function getHashForRef(def) {
  return "#L" + def.line;
}

</script>

<template>
  <div class="content-with-sidebar">
    <div class="sidebar">
      <h3>Symbols</h3>
      <SnapshotSidebarSymbolTab></SnapshotSidebarSymbolTab>
    </div>
    <div class="main-content">
      <div v-if="!symbol">
        <h2>{{ projectName }}/{{ projectRevision }}/#{{ symbolId }}</h2>
        <p>Loading...</p>
      </div>
      <div v-if="symbol">
        <h2>{{ projectName }}/{{ projectRevision }}/#{{ symbolId }}</h2>
        <h2 v-if="isClass">{{ symbol.displayName ? symbol.displayName : symbol.name }} Class</h2>
        <h2 v-else-if="isNamespace">{{ symbol.displayName ? symbol.displayName : symbol.name }} Namespace</h2>
        <h2 v-else>{{ symbol.displayName ? symbol.displayName : symbol.name }}</h2>

        <p>
          <template v-if="symbol.parent">
            <template v-if="symbol.parent.kind == 'namespace'">
              Defined in namespace
              <RouterLink
                :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: symbol.parent.id } }">
                {{ symbol.parent.name }}</RouterLink>.
            </template>
            <template v-if="symbol.parent.kind == 'class'">
              Defined in class
              <RouterLink
                :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: symbol.parent.id } }">
                {{ symbol.parent.name }}</RouterLink>.
            </template>
          </template>
          <template v-if="symbol.definitions && symbol.definitions.length > 0">
            <template v-if="symbol.definitions.length == 1">
              <RouterLink
                :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathPartsForDef(symbol.definitions[0]) }, hash: getHashForRef(symbol.definitions[0]) }">
                Go to definition</RouterLink>.
            </template>
          </template>
        </p>

        <template v-if="isClass">
          <p v-if="symbol.baseClasses && symbol.baseClasses.length > 0">
            Base classes:
            <template v-for="(base, index) in symbol.baseClasses" :key="index">
              <RouterLink
                :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: base.baseClassID } }">
                {{ base.name }}</RouterLink>{{ index == symbol.baseClasses.length - 1 ? "." : "," }}
            </template>
          </p>
          <p v-if="symbol.derivedClasses && symbol.derivedClasses.length > 0">
            Derived classes:
            <template v-for="(derived, index) in symbol.derivedClasses" :key="index">
              <RouterLink
                :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: derived.derivedClassID } }">
                {{ derived.name }}</RouterLink>{{ index == symbol.derivedClasses.length - 1 ? "." : "," }}
            </template>
          </p>
        </template>

        <template v-if="symbol.namespaces && symbol.namespaces.length > 0">
          <h3>Namespaces</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.namespaces" :key="child.id">
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="symbol.records && symbol.records.length > 0">
          <h3>Records</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.records" :key="child.id">
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="symbol.functions && symbol.functions.length > 0">
          <h3>Functions</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.functions" :key="child.id">
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.displayName ? child.displayName : child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="symbol.fields && symbol.fields.length > 0">
          <h3>Fields</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.fields" :key="child.id">
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template
          v-if="(symbol.constructors && symbol.constructors.length > 0) || (symbol.methods && symbol.methods.length > 0)">
          <h3>Functions</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.constructors" :key="child.id">
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
              <tr v-for="child in symbol.destructors" :key="child.id">
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
              <tr v-for="child in symbol.methods" :key="child.id">
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.displayName ? child.displayName : child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="symbol.references && symbol.references.length > 0">
          <h3>References</h3>
          <p v-for="refsInFile in symbol.references" :key="refsInFile.filePath">
            <b>{{ refsInFile.filePath }} ({{ refsInFile.references.length }} References): </b>
            <template v-for="(refinfo, index) in refsInFile.references" :key="index">
              <RouterLink
                :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathParts(refsInFile.filePath) }, hash: getHashForRef(refinfo) }">
                {{ refinfo.line }}</RouterLink>{{ index == refsInFile.references.length - 1 ? "." : ", " }}
            </template>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-with-sidebar {
  display: flex;
}
</style>