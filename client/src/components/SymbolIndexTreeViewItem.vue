<script setup>

import { ref, computed, inject } from 'vue'

import $ from 'jquery'

const props = defineProps({
  treeItem: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    required: false,
    default: 0
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
    <template v-if="depth > 0">
      <div v-for="i in depth" :key="i" class="nested-item-indicator">|</div>
    </template>
    <div class="item-toggle-block">
      <span  v-if="hasChildren" @click="toggle">{{ isOpen ? "-" : "+" }}</span>
    </div>
    <div class="item-icon-block">
     
    </div>
    <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: treeItem.id } }">{{ treeItem.name }}</RouterLink>
    <ul v-if="hasChildren" v-show="isOpen">
      <SymbolIndexTreeViewItem v-for="child in children" :key="child.id" :treeItem="child" :depth="depth+1"></SymbolIndexTreeViewItem>
    </ul>
  </li>
</template>

<style scoped>
.item .name {
  font-weight: bold;
}


ul {
  list-style: none;
  padding: 0;
}

.nested-item-indicator {
  display: inline-block;
  width: 1em;
  text-align: center;
}

.item-toggle-block {
  display: inline-block;
  width: 1em;
  text-align: center;
}

.item-icon-block {
  display: inline-block;
  width: 16px;
}

</style>
