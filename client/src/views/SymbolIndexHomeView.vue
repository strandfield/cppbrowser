<script setup>

import SymbolIcon from '@/components/icons/SymbolIcon.vue';

import { symbol_isMacro, macro_isUsedAsHeaderGuard } from '@cppbrowser/snapshot-tools'

import { inject } from 'vue'

const symbolTree = inject('symbolTree');

function shouldDisplaySymbol(sym) {
  return (!symbol_isMacro(sym) || !macro_isUsedAsHeaderGuard(sym));
}

</script>

<template>
  <main>
    <h1>Symbol Index</h1>
    <p>Top-level symbols:</p>
    <table v-if="symbolTree">
      <tbody>
        <tr v-for="child in symbolTree.children" :key="child.id">
          <td v-if="shouldDisplaySymbol(child)">
            <div class="d-flex align-items-center">
              <SymbolIcon :symbolKind="child.kind" class="item-icon"></SymbolIcon>
              <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: child.id } }">{{ child.name }}</RouterLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
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
