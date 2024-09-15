<script setup>

import SymbolIndexSymbolReferencesListView from '@/components/SymbolIndexSymbolReferencesListView.vue';

import { ref, onMounted, watch } from 'vue'

import $ from 'jquery'

const props = defineProps({
  symbolId: {
    type: String,
    required: true
  }
});

const symbol = ref(null);

const loaded = ref(false);
const loading = ref(false);

function fetchSymbolInfo(symbolId = null) {
  if (!symbolId) {
    symbolId = props.symbolId;
  }

  $.get(`/api/symbols/${props.symbolId}`, (data) => {
            if (data.success) {
              if (data.symbol.id == props.symbolId) {
                symbol.value = data.symbol;
              }
            }

            loading.value = false;
            loaded.value = true;
        });
  
  loading.value = true;
}

onMounted(() => {
  console.log(`SymbolIndexSymbolView is now mounted.`);
  fetchSymbolInfo();
});

watch(() => props.symbolId, fetchSymbolInfo);

</script>

<template>
  <main>
    <div v-if="loading">
      <p>Loading...</p>
    </div>
    <div v-if="loaded">
      <h2>{{ symbol.name }}</h2>
      <p v-if="symbol.parent">
        Defined in {{ symbol.parent.kind }}
        <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: symbol.parent.id } }">{{ symbol.parent.name }}
        </RouterLink>.
      </p>

      <template v-if="symbol.children">
        <template v-if="symbol.children.namespaces && symbol.children.namespaces.length > 0">
          <h3>Namespaces</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.children.namespaces" :key="child.id">
                <td>
                  <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: child.id } }">{{ child.name }}
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="symbol.children.records && symbol.children.records.length > 0">
          <h3>Records</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.children.records" :key="child.id">
                <td>
                  <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: child.id } }">{{ child.name }}
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="symbol.children.functions && symbol.children.functions.length > 0">
          <h3>Functions</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.children.functions" :key="child.id">
                <td>
                  <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: child.id } }">{{ child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template v-if="symbol.children.fields && symbol.children.fields.length > 0">
          <h3>Fields</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.children.fields" :key="child.id">
                <td>
                  <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: child.id } }">{{ child.name }}
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <template
          v-if="(symbol.children.constructors && symbol.children.constructors.length > 0) || (symbol.children.methods && symbol.children.methods.length > 0)">
          <h3>Functions</h3>
          <table>
            <tbody>
              <tr v-for="child in symbol.children.constructors" :key="child.id">
                <td>
                  <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
              <tr v-for="child in symbol.children.destructors" :key="child.id">
                <td>
                  <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
              <tr v-for="child in symbol.children.methods" :key="child.id">
                <td>
                  <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: child.id } }">
                    {{ child.name }}</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </template>

      <h2>References</h2>
      <SymbolIndexSymbolReferencesListView :symbolId="symbolId"></SymbolIndexSymbolReferencesListView>
    </div>
  </main>
</template>
