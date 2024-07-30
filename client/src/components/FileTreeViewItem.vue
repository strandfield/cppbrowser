<script setup>


import { ref, computed } from 'vue'

const props = defineProps({
  treeItem: {
    type: Object,
    required: true
  }
});

const isDir = computed(() => {
  return props.treeItem.type == 'dir';
})

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
}

</script>

<template>
  <li class="item">
    <span  v-if="isDir" @click="toggle">{{ isOpen ? "-" : "+" }}</span>
    <!--RouterLink v-if="!isDir" :to="{ name: 'project', params: { projectName: treeItem.name } }">{{ treeItem.name }}</RouterLink-->
    <span v-if="!isDir">{{ treeItem.name }}</span>
    <span v-if="isDir">{{ treeItem.name }}</span>
    <ul v-if="isDir" v-show="isOpen">
      <FileTreeViewItem v-for="entry in treeItem.children" :key="entry.path" :treeItem="entry"></FileTreeViewItem>
    </ul>
  </li>
</template>

<style scoped>
.item .name {
  font-weight: bold;
}
</style>
