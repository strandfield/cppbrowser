
import FileIndexView from '@/views/FileIndexView.vue'
import HomeView from '../views/HomeView.vue'
import ProjectSnapshotsView from '../views/ProjectSnapshotsView.vue'
import ProjectView from '@/views/ProjectView.vue'
import ProjectHomeView from '@/views/ProjectHomeView.vue'
import ProjectFilesystemView from '@/views/ProjectFilesystemView.vue'
import ProjectSymbolView from '@/views/ProjectSymbolView.vue'
import SnapshotsView from '@/views/SnapshotsView.vue'
import UploadView from '@/views/UploadView.vue'

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
      component: HomeView,
      meta: { title: "C++ Browser" }
    },
    {
      path: "/snapshots",
      name: 'allSnapshots',
      component: SnapshotsView,
      meta: { title: "Snapshots - C++ Browser" }
    },
    {
      path: "/upload",
      name: 'upload',
      component: UploadView,
      meta: { title: "Upload - C++ Browser" }
    },
    {
      path: "/snapshots/:projectName",
      name: 'project', // TODO: rename me
      component: ProjectSnapshotsView,
      props: true,
      meta: { title: "Snapshots - %projectName%" }
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
          props: true,
          meta: { title: "%projectName% - C++ Browser" }
        },
        {
          path: "files/:pathParts+",
          name: 'file',
          component: ProjectFilesystemView,
          props: true,
          meta: { title: "%filename% - %projectName%" }
        },
        {
          path: "tree/:pathParts+",
          name: 'dir',
          component: ProjectFilesystemView,
          props: true,
          meta: { title: "%filename% - %projectName%" }
        },
        {
          path: "symbols/:symbolId",
          name: 'symbol',
          component: ProjectSymbolView,
          props: true,
          meta: { title: "%projectName% - C++ Browser" }
        }
      ],
    },
    {
      path: "/files",
      component: FileIndexView,
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
          props: true,
          meta: { title: "Symbols - C++ Browser" }
        },
        {
          path: ":symbolId",
          name: 'symbolIndexSymbol',
          component: SymbolIndexSymbolView,
          props: true,
          meta: { title: "Symbols - C++ Browser" }
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
});

function formatTitle(pattern, params) {
  for (const key in params) {
    const p = params[key];
    if (typeof p == 'string') {
      pattern = pattern.replace(`%${key}%`, params[key]);
    }
  }

  if ("pathParts" in params) {
    pattern = pattern.replace("%filename%", params.pathParts[params.pathParts.length - 1]);
  }

  return pattern;
}

router.beforeEach((to, from, next) => {
  if (to.meta?.title) {
    document.title = formatTitle(to.meta.title, to.params);
  } else {
    document.title = "cppbrowser";
  }
  next();
});

export default router
