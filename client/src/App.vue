<script setup>

import { NavTooltip } from '@cppbrowser/codebrowser';

import { ref, onMounted, provide } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

let navtooltip = ref(null);
provide('navtooltip', navtooltip);

onMounted(() => {
  console.log(`App is now mounted.`);
  navtooltip.value = new NavTooltip();
});

</script>

<template>
  <header>
    <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="16" height="16" />

    <div class="wrapper">

      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/snapshots">Snapshots</RouterLink>
        <RouterLink to="/symbols">Symbols</RouterLink>
        <!--RouterLink to="/about">About</RouterLink-->
      </nav>
    </div>

    <div class="stretch">

    </div>

    <div class="right-block">
      <RouterLink to="/upload">Upload</RouterLink>
    </div>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  display: flex;
}

.logo {
  display: block;
  margin: 0 0.5rem 0 0;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
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
    place-items: center;
  }

  .logo {
    width: 24px;
    height: 24px;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    font-size: 1rem;
  }
}
</style>
