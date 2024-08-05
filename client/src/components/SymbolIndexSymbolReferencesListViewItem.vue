<script setup>

import SymbolReferencesListView from './SymbolReferencesListView.vue';

import { ref, onMounted, watch } from 'vue'

import $ from 'jquery'

const props = defineProps({
  symbolId: {
    type: String,
    required: true
  },
  projectName: {
    type: String,
    required: true
  },
  projectVersions: {
    type: Array,
    required: true
  }
});

const projectVersion = ref(null);

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
}

onMounted(() => {
  if (props.projectVersions.length > 0) {
    projectVersion.value = props.projectVersions[0];
  }
});

</script>

<template>
  <div class="references-in-project-item">
    <div class="header">
      <h3>{{ projectName }}</h3>
      <h4>{{ projectVersion }}</h4>
      <span @click="toggle">{{ isOpen ? "-" : "+" }}</span>
    </div>
    <div v-show="isOpen" class="content">
      <SymbolReferencesListView v-if="isOpen" :symbolId="symbolId" :projectName="projectName" :projectVersion="projectVersion" ></SymbolReferencesListView>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: flex;
}
</style>
