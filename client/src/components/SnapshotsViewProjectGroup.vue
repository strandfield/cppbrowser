<script setup>

import { ref } from 'vue'

const props = defineProps({
  project: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['selectionChanged']);


const projectCheckboxElement = ref(null);
const listElement = ref(null);

function onChange(event) {
  let children = [...listElement.value.getElementsByTagName('input')];
      
  if (event.target == projectCheckboxElement.value) {
    if (!event.target.indeterminate) {
      for (let child of children) {
        child.checked = event.target.checked;
      }
    }
  } else {
    let all_checked =  children.find(e => !e.checked) == null;
    let all_unchecked =  children.find(e => e.checked) == null;

    if (all_checked || all_unchecked) {
      projectCheckboxElement.value.indeterminate = false;
      projectCheckboxElement.value.checked = all_checked;
    } else {
      projectCheckboxElement.value.indeterminate = true;
    }
  }

  let new_selection = {};

  for (const child of children) {
    new_selection[child.name] = child.checked;
  }

  emit('selectionChanged',  {
    project: props.project.name,
    revisions: new_selection
  });
}

</script>

<template>
  <div class="item">
    <h2><input type="checkbox" :name="project.name" @change="onChange" ref="projectCheckboxElement"/>{{ project.name }}</h2>
    <ul v-if="project.revisions.length > 0" ref="listElement">
      <li  v-for="rev in project.revisions" :key="rev.name">
        <input type="checkbox" :name="rev.name" @change="onChange"/>{{ rev.name }}
        <a :href="`/download/${project.name}/${ rev.name }`">Download</a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.item .name {
  font-weight: bold;
}

h2 {
  display: flex;
  align-items: baseline;
}

input {
  margin-right: 1em;
}

ul {
  list-style: none;
}
</style>
