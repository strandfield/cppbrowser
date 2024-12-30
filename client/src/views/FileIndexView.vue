<script setup>

import { ref, onMounted, computed } from 'vue'

import $ from 'jquery'

const apiFileList = ref([]);

function computeFileEntries(files) {
  let result = [];
  for (const f of files) {
    let e = {
      key: f.projectName + ":" + f.path
    };
    Object.assign(e, f);
    result.push(e);
  }

  const collator = new Intl.Collator();
  result.sort((a,b) => collator.compare(a.key, b.key));
  return result;
}

const fileEntries = computed(() => computeFileEntries(apiFileList.value));

function fetchFileList() {
  $.get("/api/files", (data) => {
            if (data.success) {
              apiFileList.value = data.files;
            }
        });
}

onMounted(() => {
  fetchFileList();
});

// TODO: put that in a lib
function getPathParts(path) {
  return path.split("/");
}

</script>

<template>
  <main>
    <h1>Files</h1>
    <table>
      <tbody>
        <tr v-for="e in fileEntries" :key="e.key">
          <td>
            <div class="d-flex align-items-center">
              <img src="/file.svg" class="item-icon" />
              <RouterLink
                :to="{ name: 'file', params: { projectName: e.projectName, projectRevision: e.projectRevision, pathParts: getPathParts(e.path) } }">
               {{ e.projectName }} &gt; {{ e.path }}</RouterLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>

/* TODO: put that in a css */
.item-icon {
  margin-right: 0.5em;
}

</style>