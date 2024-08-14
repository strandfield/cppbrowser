<script setup>

import { computed, inject } from 'vue'

const props = defineProps({
  matchResult: {
    type: Object,
    required: true
  }
});

const projectName = inject('projectName');
const projectRevision = inject('projectRevision');

const matchParts = computed(() => {
  let result = [];
  let text = props.matchResult.element;
  let i = 0;
  for (const letter_index of props.matchResult.match) {
    if (i < letter_index) {
      result.push({
        class: "non-matching-text",
        text: text.substring(i, letter_index)
      });
    }

    result.push({
        class: "matching-text",
        text: text[letter_index]
      });
    i = letter_index + 1;
  }

  if (i < text.length) {
    result.push({
      class: "non-matching-text",
      text: text.substring(i)
    });
  }

  return result;
});

function splitPath(path) {
  return path.split("/");
}

</script>

<template>
  <li>
    <RouterLink
      :title="matchResult.element"
      :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectRevision, pathParts: splitPath(matchResult.element) } }">
      <span v-for="(part,index) in matchParts" :key="index" :class="part.class">{{ part.text }}</span></RouterLink>
  </li>
</template>

<style scoped>
.matching-text {
  font-weight: bold;
}

li {
  border-bottom: 1px solid lightgray;
  display: flex;
  white-space: nowrap;
}

li a {
  display: inline-block;
  text-overflow: ellipsis;
  overflow: hidden;
  direction: rtl;
  flex-shrink: 1;
}
</style>
