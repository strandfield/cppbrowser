<script setup>
defineProps({
  revision: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <li class="item">
    <span class="name">{{ revision.projectName }}/{{ revision.name }}</span>
  </li>
</template>

<style scoped>

</style>
