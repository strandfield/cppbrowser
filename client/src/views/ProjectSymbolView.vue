<script setup>

import SnapshotSidebarSymbolTab from '@/components/SnapshotSidebarSymbolTab.vue'
import SymbolReferencesListView from '@/components/SymbolReferencesListView.vue';
import SymbolDeclarationsListView from '@/components/SymbolDeclarationsListView.vue';

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
const listChildren = computed(() => isNamespace.value);

const declsListView = ref(null);

function postProcessSymbolInfo(syminfo) {
  if (syminfo.functions) {
    syminfo.functions.sort((a,b) => a.name.localeCompare(b.name));
  } else {
    syminfo.functions = [];
  }

  if (syminfo.methods) {
    syminfo.methods.sort((a,b) => a.name.localeCompare(b.name));
  } else {
    syminfo.methods = [];
  }

  if (syminfo.staticMethods) {
    syminfo.staticMethods.sort((a,b) => a.name.localeCompare(b.name));
  } else {
    syminfo.staticMethods = [];
  }
}

function fetchSymbolInfo() {
  const recv = function (data) {
    if (data.success) {
        postProcessSymbolInfo(data.symbol);
        symbol.value = data.symbol;
        document.title = `${data.symbol.name} - ${props.projectName}`;
      } else {
        console.error(data);
      }
  }

  $.get(`/api/snapshots/${props.projectName}/${props.projectRevision}/symbols/${props.symbolId}`, recv);
}

watch(() => props.projectName + "/" + props.projectRevision + "/" + props.symbolId, fetchSymbolInfo, { immediate: false });

onMounted(() => {
  fetchSymbolInfo();
});

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
    <main class="main-content">
      <div v-if="!symbol">
        <h2>{{ projectName }}/{{ projectRevision }}/#{{ symbolId }}</h2>
        <p>Loading...</p>
      </div>
      <div v-if="symbol">
        <h1 v-if="isClass">{{ symbol.name }} Class</h1>
        <h1 v-else-if="isNamespace">{{ symbol.name }} Namespace</h1>
        <h1 v-else>{{ symbol.name }}</h1>

        <p>
          <b>Symbol ID: #{{ symbolId }}</b>
        </p>

        <p>
          <template v-if="symbol.parent">
            <template v-if="symbol.parent.kind == 'namespace'">
              Defined in namespace
              <RouterLink
                :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: symbol.parent.id } }">
                {{ symbol.parent.name }}</RouterLink>.
            </template>
            <template v-else-if="symbol.parent.kind == 'class'">
              Defined in class
              <RouterLink
                :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: symbol.parent.id } }">
                {{ symbol.parent.name }}</RouterLink>.
            </template>
            <template v-else>
              Defined in
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

        <template v-if="symbol.definitions && symbol.definitions.length > 1">
            <p v-for="def in symbol.definitions" :key="def.filePath + def.line">
              Defined in {{ def.filePath }} on line 
              <RouterLink
                :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: getPathPartsForDef(def) }, hash: getHashForRef(def) }">
                {{ def.line }}</RouterLink>.
            </p>
        </template>

        <!-- TODO: the following v-if shouldn't consider only namespaces as there are other symbol kinds
             for which declarations aren't collected.
             We will need to add a function in cppscanner's genjs to list such symbolkinds -->
        <template v-if="symbol.kind != 'namespace'">
          <h2 v-if="declsListView?.loaded && declsListView?.symbolDeclarations.length > 0">Declarations</h2>
          <SymbolDeclarationsListView :projectName="projectName" :projectVersion="projectRevision" :symbolId="symbolId" ref="declsListView"></SymbolDeclarationsListView>
        </template>
        
        <template v-if="false && isClass">
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

        <template v-if="listChildren && symbol.enums && symbol.enums.length > 0">
          <h3>Enumerations</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.enums" :key="child.id">
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="false && symbol.enumConstants && symbol.enumConstants.length > 0">
          <h3>Values</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.enumConstants" :key="child.id">
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="listChildren && symbol.records && symbol.records.length > 0">
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

        <template v-if="listChildren && symbol.functions.length > 0">
          <h3>Functions</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.functions" :key="child.id">
                <td class="return-type">
                  {{ child.returnType }}
                </td>
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="listChildren && symbol.fields && symbol.fields.length > 0">
          <h3>Fields</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.fields" :key="child.id">
                <td>
                  {{ child.type }}
                </td>
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
          v-if="listChildren && ((symbol.constructors && symbol.constructors.length > 0) || symbol.methods.length > 0)">
          <h3>Functions</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.constructors" :key="child.id">
                <td></td>
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
              <tr v-for="child in symbol.destructors" :key="child.id">
                <td></td>
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
              <tr v-for="child in symbol.methods" :key="child.id">
                <td class="return-type">
                  {{ child.returnType }}
                </td>
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
          v-if="listChildren && symbol.staticMethods.length > 0">
          <h3>Static methods</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.staticMethods" :key="child.id">
                <td class="return-type">
                  {{ child.returnType }}
                </td>
                <td>
                  <RouterLink
                    :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="symbol.kind != 'namespace'">
          <h2>References</h2>
          <SymbolReferencesListView :projectName="projectName" :projectVersion="projectRevision" :symbolId="symbolId"></SymbolReferencesListView>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.content-with-sidebar {
  display: flex;
}

.sidebar {
  padding: 1rem;
  width: 320px;
}

.main-content {
  flex-grow: 1;
}

.return-type {
  text-align: right;
}
</style>