<script setup>

import { snapshots } from '@/state/snapshots';

import $ from 'jquery';

import { ref, onMounted } from 'vue'

const dragOver = ref(false);
const isUploading = ref(false);
const uploadStatus = ref(null);

function doUploadFile(file) {
  console.log(file);

  let form_data = new FormData();
  form_data.append("database", file, file.name);

  isUploading.value = true;
  uploadStatus.value = null;

  $.ajax({
    url: "/api/snapshots",
    type: 'POST',
    data: form_data,
    success: function (data) {
      isUploading.value = false;
      if (data.success) {
        uploadStatus.value = "Success";
        snapshots.forceReload();
      } else {
        uploadStatus.value = "Error: " + data.reason;
      }
    },
    cache: false,
    contentType: false,
    processData: false,
  });
}

function onDragEnter(ev) {
  ev.preventDefault();
  dragOver.value = true;
}

function onDragOver(ev) {
  ev.preventDefault();
}

function onDragLeave(ev) {
  ev.preventDefault();
  dragOver.value = false;
}

function onDrop(ev) {
  dragOver.value = false;
  ev.preventDefault();

  let files = [];

  if (ev.dataTransfer.items) {
    [...ev.dataTransfer.items].forEach((item) => {
      if (item.kind === "file") {
        const file = item.getAsFile();
        files.push(file);
      }
    });
  } else {
    [...ev.dataTransfer.files].forEach((file) => {
      files.push(file);
    });
  }

  if (files.length > 0) {
    if (files.length == 1) {
      doUploadFile(files[0]);
    }
  }
}

</script>

<template>
  <main>
    <h1>Upload</h1>

    <div v-show="!isUploading" id="drop-zone" @dragenter="onDragEnter" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
      <p v-show="!dragOver">Drag'n drop a snapshot file to this <i>drop zone</i>.</p>
      <p v-show="dragOver">Dropt it now!</p>
    </div>

    <div v-if="isUploading">
      <p>Upload in progress</p>
    </div>

    <div v-if="uploadStatus">
      <p>Upload status: {{ uploadStatus }}</p>
    </div>

    <!-- <form enctype="multipart/form-data">
      <input type="file" name="database" />
      <label for="projectname">Project name</label>
      <input type="text" name="projectname" />
      <label for="projectrevision">Project revision</label>
      <input type="text" name="projectrevision" />
      <button>Submit</button>
    </form> -->
  </main>
</template>

<style scoped>

#drop-zone {
  border: 2px dashed grey;
  width: 300px;
  height: 100px;
  padding: 1em;
  text-align: center
}

</style>