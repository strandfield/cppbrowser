import HomeView from '../views/HomeView.vue'
import ProjectView from '../views/ProjectView.vue'
import SnapshotView from '@/views/SnapshotView.vue'
import SnapshotHomeView from '@/views/SnapshotHomeView.vue'
import FileView from '@/views/FileView.vue'
import DirectoryView from '@/views/DirectoryView.vue'

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
      component: SnapshotView,
      props: true,
      children: [
        {
          path: "",
          name: 'snapshot',
          component: SnapshotHomeView,
          props: true
        },
        {
          path: "files/:pathParts+",
          name: 'file',
          component: FileView,
          props: true
        }
        ,
        {
          path: "tree/:pathParts+",
          name: 'dir',
          component: DirectoryView,
          props: true
        }
      ],
    },

    // ,
    // {
    //   path: '/about',
    //   name: 'about',
    //   // route level code-splitting
    //   // this generates a separate chunk (About.[hash].js) for this route
    //   // which is lazy-loaded when the route is visited.
    //   component: () => import('../views/AboutView.vue')
    // }
  ]
})

export default router
