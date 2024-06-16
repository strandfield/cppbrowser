
const { ProjectRevision } = require("../src/project.js");
let ProjectManager = require("../src/projectmanager.js");

var express = require('express');

function createBreadCrumb(dir) {
  let result = [];

  if (dir.parent_path) {
    let parts = dir.parent_path.split('/');
    let current = "";

    for (const p of parts) {
      current += p;
      result.push({
        type: 'dir',
        name: p,
        path: current
      });
      current += "/";
    }
  }

  result.push({
    type: 'current',
    name: dir.name
  });

  return result;
}

function createBreadCrumbForFile(filepath) {
  let i = filepath.lastIndexOf('/');
  if (i != -1) {
    return createBreadCrumb({
      name: filepath.substring(i+1),
      parent_path: filepath.substring(0, i)
    });
  } else {
    return createBreadCrumb({
      name: filepath
    });
  }
}

function createRouter(app) {

  var router = express.Router();

  let can_upload = app?.conf?.features?.upload ?? true;
  let can_delete_project = app?.conf?.features?.deleteProject ?? true;

  /* GET home page. */
  router.get('/', function (req, res, next) {
    let projects = [];
    let project_manager = ProjectManager.globalInstance;
    for (const name in project_manager.projects) {
      let p = project_manager.getProjectByName(name);
      if (p) {
        projects.push(p);
      }
    }
    res.render('index', {
      title: 'cppbrowser',
      projects: projects,
      can_upload: can_upload
    });
  });


  router.get('/:projectName', function (req, res, next) {
    let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);

    if (!project) {
      next();
      return;
    }

    let revision = project.revisions[0];

    let home_dir_entries = revision.getDirectoryEntries(revision.homeDir);

    res.render('project', {
      title: req.params.projectName,
      project: project,
      projectRevision: revision,
      homeDirEntries: home_dir_entries,
      can_delete_project: can_delete_project
    });
  });

  if (can_delete_project) {
    router.delete('/:projectName', function (req, res, next) {
      let projectmanager = ProjectManager.globalInstance;
  
      let done = projectmanager.removeProject(req.params.projectName);
  
      res.json({
        success: done
      });
    });
  }

  router.get('/:projectName/tree/:revision/*', function (req, res, next) {
    let path = req.params[0];

    let pman = ProjectManager.globalInstance;
    let project = pman.getProjectByName(req.params.projectName);

    if (!project) {
      next();
      return;
    }

    let revision = project.getRevision(req.params.revision);

    if (!revision) {
      next();
      return;
    }

    let dirinfo = revision.getDirectoryInfo(path);

    if (!dirinfo || dirinfo.entries.length == 0) {
      next();
      return;
    }

    res.render('tree', {
      title: req.params.projectName,
      project: project,
      projectRevision: revision,
      dir: dirinfo,
      breadcrumb: createBreadCrumb(dirinfo)
    });
  });

  router.get('/:projectName/blob/:revision/*', function (req, res, next) {
    let path = req.params[0];

    let pman = ProjectManager.globalInstance;
    let project = pman.getProjectByName(req.params.projectName);

    if (!project) {
      next();
      return;
    }

    let revision = project.getRevision(req.params.revision);

    if (!revision) {
      next();
      return;
    }

    let f = revision.getFileByPath(revision.homeDir + "/" + path);

    if (!f) {
      next();
      return;
    }

    let content = revision.getFileContent(f.id);

    if (!content) {
      next();
      return;
    }

    let symrefs = revision.listSymbolReferencesInFile(f.id);
    if (symrefs) {
      symrefs.symbolKinds = revision.symbolKinds;
      symrefs.symbolFlags = revision.symbolFlags;
      symrefs.refFlags = revision.symbolReferenceFlags;
    }
    let symdefs = revision.listDefinitionsOfSymbolsReferencedInFile(f.id);
    let symdeffiles = {};
    for (const [key, value] of Object.entries(symdefs)) {
      symdeffiles[value.fileid] = revision.getFilePath(value.fileid);
    }
    let diagnostics = revision.getFileDiagnostics(f.id);
    let includes = revision.getFileIncludes(f.id);

    res.render('blob', {
      title: req.params.projectName,
      project: project,
      projectRevision: revision,
      breadcrumb: createBreadCrumbForFile(path),
      file: {
        id: f.id,
        path: f.path,
        content: content,
        diagnosticLevels: diagnostics.diagnosticLevels,
        diagnostics: diagnostics.diagnostics,
        includes: includes,
        sema: symrefs,
        symdefs: {
          definitions: symdefs,
          files: symdeffiles
        }
      }
    });
  });

  return router;
}

module.exports = app => createRouter(app);
