import HomeView from '../views/HomeView.vue'
import ProjectView from '../views/ProjectView.vue'
import SnapshotView from '@/views/SnapshotView.vue'
import FileView from '@/views/FileView.vue'

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: "/snapshots/:projectName",
      name: 'project',
      component: ProjectView,
      props: true
    },
    {
      path: "/snapshots/:projectName/:projectRevision",
      name: 'snapshot',
      component: SnapshotView,
      props: true
    },
    {
      path: "/snapshots/:projectName/:projectRevision/files/:pathParts+",
      name: 'file',
      component: FileView,
      props: true
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue')
    }
  ]
})

export default router
