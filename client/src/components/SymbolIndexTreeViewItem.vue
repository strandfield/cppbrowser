<script setup>

import SymbolIcon from './icons/SymbolIcon.vue';

import { symbol_isMacro, macro_isUsedAsHeaderGuard } from '@cppbrowser/snapshot-tools'

import { ref, computed } from 'vue'

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

const shouldBeDisplayed = computed(() => {
  return (!symbol_isMacro(props.treeItem) || !macro_isUsedAsHeaderGuard(props.treeItem));
});

const hasChildren = computed(() => {
  return props.treeItem.childCount > 0;
})

const isOpen = ref(false);

function fetchChildren() {
  $.get(`/api/symbols/tree/${props.treeItem.id}`, (data) => {
            if (data.success) {
              if (data.symbol.id == props.treeItem.id) {
                data.children = data.children.sort((a,b) => a.name.localeCompare(b.name));
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
  <li class="item" v-show="shouldBeDisplayed">
    <div class="item-content">
      <template v-if="depth > 0">
        <div v-for="i in depth" :key="i" class="indent"><div class="nested-item-indicator"></div></div>
      </template>
      <div class="item-toggle-block">
        <img v-if="hasChildren" @click="toggle" :src="isOpen ? '/chevron-down.svg' : '/chevron-right.svg'"
            class="toggle-image" />
      </div>
      <div class="item-icon-block">
        <SymbolIcon :symbolKind="treeItem.kind"></SymbolIcon>
      </div>
      <RouterLink :to="{ name: 'symbolIndexSymbol', params: { symbolId: treeItem.id } }" class="name">{{ treeItem.name }}</RouterLink>
    </div>
    <ul v-if="hasChildren" v-show="isOpen">
      <SymbolIndexTreeViewItem v-for="child in children" :key="child.id" :treeItem="child" :depth="depth + 1"></SymbolIndexTreeViewItem>
    </ul>
  </li>
</template>

<style scoped>

.item {
  
}

.item-content {
  display: flex;
  align-items: center;
}

.item-content .name {
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  text-wrap: nowrap;
}

ul {
  list-style: none;
  padding: 0;
}

.indent {
  display: inline-block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.nested-item-indicator {
  margin-left: 10px;
  width: 1px;
  height: 22px;
  background-color: lightgrey;
  border-right: 1px solid lightgrey;
}

.item-toggle-block {
  display: inline-block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.toggle-image {
  display: block;
  margin-left: 3px;
  margin-top: 4px;
}

.item-icon-block {
  display: inline-block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;

  padding-left: 3px;
  padding-top: 4px; 
}

</style>
