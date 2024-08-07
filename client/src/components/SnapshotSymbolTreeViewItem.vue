<script setup>

import { ref, computed, inject, watch } from 'vue'

import $ from 'jquery'

const props = defineProps({
  treeItem: {
    type: Object,
    required: true
  }
});

const projectName = inject('projectName');
const projectRevision = inject('projectRevision');

const fetchUrl = computed(() => `/api/snapshots/${projectName}/${projectRevision}/symbols/tree?symbolId=${props.treeItem.id}`);

const children = ref([]);

const loaded = ref(false);
const loading = ref(false);

const canHaveChildren = computed(() => {
  // TODO: use heuristic -> class,namespace,struct, union => true
  return true;
});

const hasChildren = computed(() => {
  return loaded.value && children.value.length > 0;
})

const isOpen = ref(false);

function fetchChildren() {
  $.get(fetchUrl.value, (data) => {
            if (data.success) {
              if (data.symbol.id == props.treeItem.id) {
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
  <li class="item">
    <span  v-if="hasChildren || (!loaded && canHaveChildren)" @click="toggle">{{ isOpen ? "-" : "+" }}</span>
    <RouterLink :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectRevision, symbolId: treeItem.id } }">{{ treeItem.name }}</RouterLink>
    <ul v-if="hasChildren" v-show="isOpen">
      <SnapshotSymbolTreeViewItem v-for="child in children" :key="child.id" :treeItem="child"></SnapshotSymbolTreeViewItem>
    </ul>
  </li>
</template>

<style scoped>
.item .name {
  font-weight: bold;
}
</style>
