
import HomeView from '../views/HomeView.vue'
import ProjectSnapshotsView from '../views/ProjectSnapshotsView.vue'
import ProjectView from '@/views/ProjectView.vue'
import ProjectHomeView from '@/views/ProjectHomeView.vue'
import ProjectFilesystemView from '@/views/ProjectFilesystemView.vue'
import ProjectSymbolView from '@/views/ProjectSymbolView.vue'

import SymbolIndexView from '@/views/SymbolIndexView.vue'
import SymbolIndexHomeView from '@/views/SymbolIndexHomeView.vue'
import SymbolIndexSymbolView from '@/views/SymbolIndexSymbolView.vue'

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
      name: 'project', // TODO: rename me
      component: ProjectSnapshotsView,
      props: true
    },
    {
      path: "/snapshots/:projectName/:projectRevision",
      component: ProjectView,
      props: true,
      children: [
        {
          path: "",
          name: 'snapshot',
          component: ProjectHomeView,
          props: true
        },
        {
          path: "files/:pathParts+",
          name: 'file',
          component: ProjectFilesystemView,
          props: true
        },
        {
          path: "tree/:pathParts+",
          name: 'dir',
          component: ProjectFilesystemView,
          props: true
        },
        {
          path: "symbols/:symbolId",
          name: 'symbol',
          component: ProjectSymbolView,
          props: true
        }
      ],
    },
    {
      path: "/symbols",
      component: SymbolIndexView,
      props: true,
      children: [
        {
          path: "",
          name: 'symbolIndex',
          component: SymbolIndexHomeView,
          props: true
        },
        {
          path: ":symbolId",
          name: 'symbolIndexSymbol',
          component: SymbolIndexSymbolView,
          props: true
        },
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
