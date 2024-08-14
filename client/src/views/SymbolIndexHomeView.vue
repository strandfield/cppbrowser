<script setup>


import { inject } from 'vue'

const symbolTree = inject('symbolTree');

</script>

<template>
  <main>
    <h2>Symbol Index</h2>
    <p>Welcome to the symbol index.</p>
    <table v-if="symbolTree">
      <tbody>
        <tr v-for="child in symbolTree.children" :key="child.id">
          <td><RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: child.id } }">{{ child.name }}</RouterLink></td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
