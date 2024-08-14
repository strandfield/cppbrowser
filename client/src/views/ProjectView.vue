<script setup>

import { files } from '@/state/files';
import { snapshots } from '@/state/snapshots';

import { useRoute, useRouter } from 'vue-router'

import { ref, toRef, onMounted, provide, watch } from 'vue'
import ProjectViewSearchBar from '@/components/ProjectViewSearchBar.vue';

const route = useRoute();
const router = useRouter();

const props = defineProps({
  projectName: String,
  projectRevision: String
});

provide('projectName', toRef(() => props.projectName));
provide('projectRevision', toRef(() => props.projectRevision));

const project = ref(null);

const myfiles = ref([]);
const myFileTree = ref(null);

provide('snapshotFiles', myfiles);
provide('snapshotFileTree', myFileTree);

function receiveSnapshotFiles(projectName, projectRevision, data) {
  if (projectName == props.projectName && projectRevision == props.projectRevision) {
    myfiles.value = data.files;
    myFileTree.value = data.tree;
  }
}

function fetchSnapshotFiles() {
  console.log(`fetching files for ${props.projectName}/${props.projectRevision}`);
  files.getFilesForSnapshot(props.projectName, props.projectRevision, receiveSnapshotFiles);
}

const selectedRevision = ref(null);

function fetchProject(name = null) {
  if (!name) {
    name = props.projectName;
  }
  if (snapshots.state == 'loaded') {
    project.value = snapshots.getProject(name);
  }
}

onMounted(() => {
  console.log(`projectview is now mounted.`);
  snapshots.load();
  fetchProject();
  fetchSnapshotFiles();
  selectedRevision.value = props.projectRevision;
});

function onSnapshotsStateChanged(state) {
  if (state == 'loaded') {
    fetchProject();
  }
}

watch(() => props.projectName, fetchProject, { immediate: false });
watch(() => props.projectName + "/" + props.projectRevision, fetchSnapshotFiles, { immediate: false });
watch(() => snapshots.state, onSnapshotsStateChanged, { immediate: false });

function changeSelectedRevision() {
  if (selectedRevision.value != props.projectRevision) {
    let routing_options = {
      name: route.name,
      params: {

      },
      hash: route.hash
    };

    Object.assign(routing_options.params, route.params);
    routing_options.params.projectRevision =  selectedRevision.value;

    router.push(routing_options);
  }
}

watch(() => selectedRevision.value, changeSelectedRevision, { immediate: false });

</script>

<template>
  <div class="project-view">
    <nav>
      <RouterLink :to="{ name: 'snapshot', params: { projectName: projectName, projectRevision: projectRevision } }">{{ projectName }}</RouterLink>»
      <select v-if="project" class="version-select" v-model="selectedRevision">
        <option v-for="rev in project.revisions" :key="rev.name">{{ rev.name }}</option>
      </select>
      <RouterLink v-if="project" :to="{ name: 'project', params: { projectName: projectName} }">{{ project.revisions.length }} snapshots</RouterLink>
      <div class="flex-stretch"></div>
      <div class="right-block">
        <ProjectViewSearchBar></ProjectViewSearchBar>
      </div>
    </nav>
    <div class="content">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>

.project-view {

}

.project-view nav {
  display: flex;
  align-items: center;
  padding: 0.3em 1em;
  background-color: beige;
  font-size: 12px;
}

.version-select {
  margin: 0 1em;
}

.flex-stretch {
  flex-grow: 1;
}


@media (min-width: 1024px) {
  .project-view nav {
    font-size: 1rem;
  }
}
</style>