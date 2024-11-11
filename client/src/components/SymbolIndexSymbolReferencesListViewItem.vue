<script setup>

import SymbolReferencesListView from './SymbolReferencesListView.vue';

import { ref, onMounted } from 'vue'

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
      <div class="stretch"></div>
      <select v-model="projectVersion">
        <option v-for="v in projectVersions" :key="v" :value="v">{{ v }}</option>
      </select>
      <img @click="toggle" :src="isOpen ? '/chevron-down.svg' : '/chevron-left.svg'" class="toggle-image" />
    </div>
    <div v-show="isOpen" class="content">
      <SymbolReferencesListView v-if="isOpen" :symbolId="symbolId" :projectName="projectName" :projectVersion="projectVersion"></SymbolReferencesListView>
    </div>
  </div>
</template>

<style scoped>
.references-in-project-item {
  margin-right: 1em;
  margin-bottom: 1em;
  border-radius: 4px;
  padding: 0.5em;
  background-color: beige;
}

.header {
  display: flex;
}

.header select {
  margin-right: 1em;
}
.stretch {
  flex-grow: 1;
}

.toggle-image {
  width: 22px;
  height: 22px;
}

.content {
  padding: 0.5em;
}

</style>
