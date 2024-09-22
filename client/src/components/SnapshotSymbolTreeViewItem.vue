<script setup>

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
    <template v-if="depth > 0">
      <div v-for="i in depth" :key="i" class="nested-item-indicator">|</div>
    </template>
    <div class="item-toggle-block">
      <span  v-if="hasChildren || (!loaded && canHaveChildren)" @click="toggle">{{ isOpen ? "-" : "+" }}</span>
    </div>
    <div class="item-icon-block">
     
    </div>
    <RouterLink :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: treeItem.id } }">{{ treeItem.name }}</RouterLink>
    <ul v-if="hasChildren" v-show="isOpen">
      <SnapshotSymbolTreeViewItem v-for="child in children" :key="child.id" :treeItem="child" :depth="depth + 1"></SnapshotSymbolTreeViewItem>
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
