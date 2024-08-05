<script setup>

import { ref, computed, inject } from 'vue'

import $ from 'jquery'

const props = defineProps({
  treeItem: {
    type: Object,
    required: true
  }
});

const children = ref([]);

const loaded = ref(false);
const loading = ref(false);

const hasChildren = computed(() => {
  return props.treeItem.childCount > 0;
})

const isOpen = ref(false);

function fetchChildren() {
  $.get(`/api/symbols/tree/${props.treeItem.id}`, (data) => {
            if (data.success) {
              if (data.symbol.id == props.treeItem.id) {
                children.value = data.children;
              }
            }

            loading.value = false;
            loaded.value = true;
        });
  
  loading.value = true;
}

function toggle() {
  if (!isOpen.value) { // if about to open
    if (!loaded.value) { // and not loaded
      fetchChildren(); // fetch data
    }
  }

  isOpen.value = !isOpen.value;
}

</script>

<template>
  <li class="item">
    <span  v-if="hasChildren" @click="toggle">{{ isOpen ? "-" : "+" }}</span>
    <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: treeItem.id } }">{{ treeItem.name }}</RouterLink>
    <ul v-if="hasChildren" v-show="isOpen">
      <SymbolIndexTreeViewItem v-for="child in children" :key="child.id" :treeItem="child"></SymbolIndexTreeViewItem>
    </ul>
  </li>
</template>

<style scoped>
.item .name {
  font-weight: bold;
}
</style>
