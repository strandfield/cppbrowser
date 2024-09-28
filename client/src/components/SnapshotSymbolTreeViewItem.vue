<script setup>

import SymbolIcon from '@/components/icons/SymbolIcon.vue';

import { symbol_isFromProject, symbol_isMacro, symbol_isVarLike } from '@cppbrowser/snapshot-tools'

import { ref, computed, inject, watch } from 'vue'

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

const projectName = inject('projectName');
const projectRevision = inject('projectRevision');

const fetchUrl = computed(() => `/api/snapshots/${projectName}/${projectRevision.value}/symbols/tree?symbolId=${props.treeItem.id}`);

const children = ref([]);

const loaded = ref(false);
const loading = ref(false);

const canHaveChildren = computed(() => {
  // TODO: add enum-constant
  return !symbol_isMacro(props.treeItem)
   && !symbol_isVarLike(props.treeItem);
});

const shouldBeDisplayed = computed(() => {
  return symbol_isFromProject(props.treeItem)
    && (!symbol_isMacro(props.treeItem));
});

const hasChildren = computed(() => {
  return loaded.value && children.value.length > 0;
})

const isOpen = ref(false);

function fetchChildren() {
  $.get(fetchUrl.value, (data) => {
            if (data.success) {
              if (data.symbol.id == props.treeItem.id) {
                data.children = data.children.sort((a,b) => a.name.localeCompare(b.name));
                children.value = data.children;
              }
            }

            loading.value = false;
            loaded.value = true;
        });
  
  loaded.value = false;
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

function refetchChildren() {
  if (isOpen.value) {
    fetchChildren();
  }
}

watch(fetchUrl, refetchChildren);

</script>

<template>
  <li class="item" v-show="shouldBeDisplayed">
    <div class="item-content">
      <template v-if="depth > 0">
        <div v-for="i in depth" :key="i" class="indent"><div class="nested-item-indicator"></div></div>
      </template>
      <div class="item-toggle-block">
        <img v-if="hasChildren || (!loaded && canHaveChildren)" @click="toggle" :src="isOpen ? '/chevron-down.svg' : '/chevron-right.svg'"
            class="toggle-image" />
      </div>
      <div class="item-icon-block">
        <SymbolIcon :symbolKind="treeItem.kind"></SymbolIcon>
      </div>
      <RouterLink :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: treeItem.id } }" class="name">{{ treeItem.name }}</RouterLink>
    </div>
    <ul v-if="hasChildren" v-show="isOpen">
      <SnapshotSymbolTreeViewItem v-for="child in children" :key="child.id" :treeItem="child" :depth="depth + 1"></SnapshotSymbolTreeViewItem>
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
