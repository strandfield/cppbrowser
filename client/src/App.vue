<script setup>

import { NavTooltip } from '@cppbrowser/codebrowser';

import { session, checkPermissions } from '@/state/session';

import { ref, onMounted, provide } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

let navtooltip = ref(null);
provide('navtooltip', navtooltip);

onMounted(() => {
  console.log(`App is now mounted.`);
  navtooltip.value = new NavTooltip();
  if (!session.permissions.hasCheckedPermissions) {
    checkPermissions();
  }
});

</script>

<template>
  <header>
    <div class="wrapper">

      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/snapshots">Snapshots</RouterLink>
        <RouterLink to="/files">Files</RouterLink>
        <RouterLink to="/symbols">Symbols</RouterLink>
        <!--RouterLink to="/about">About</RouterLink-->
      </nav>
    </div>

    <div class="stretch">

    </div>

    <nav class="right-nav">
      <RouterLink v-if="session.permissions.uploadSnapshot" to="/upload">Upload</RouterLink>
    </nav>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  padding: 0.5em 1em;
  display: flex;
  place-items: center;
  font-size: 12px;
}

nav {
  
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

.stretch {
  flex-grow: 1;
}

@media (min-width: 1024px) {
  header {
    font-size: 1rem;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
  }
}
</style>
