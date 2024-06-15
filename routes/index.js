
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
    res.render('index', {
      title: 'cppbrowser',
      projects: ProjectManager.globalInstance.projects,
      can_upload: can_upload
    });
  });


  router.get('/:projectName', function (req, res, next) {
    let p = ProjectManager.globalInstance.getProjectByName(req.params.projectName);

    if (!p) {
      next();
      return;
    }

    let files = p.getAllFilesInRootFolder();
    if (!files) {
      files = p.getAllFilesWithContent();
      files.forEach(f => {
        f.url = 'file/' + f.id;
      });
    } else {
      files.forEach(f => {
        f.fullPath = f.path;
        f.path = f.fullPath.substring(p.rootDir.length + 1)
        f.url = 'blob/' + (f.path);
      });
    }

    let entries = p.getDirectoryEntries(p.rootDir);

    res.render('project', {
      title: req.params.projectName,
      project: p,
      files: files,
      entries: entries,
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

  router.get('/:projectName/file/:fileId', function (req, res, next) {
    let pman = ProjectManager.globalInstance;
    let p = pman.getProjectByName(req.params.projectName);

    if (!p) {
      next();
      return;
    }

    let fileid = Number.parseInt(req.params.fileId);
    let fpath = p.files[fileid];

    if (!fpath) {
      next();
      return;
    }

    let content = p.getFileContent(fileid);

    if (!content) {
      next();
      return;
    }

    res.render('blob', {
      title: req.params.projectName,
      project: p,
      file: {
        id: fileid,
        path: fpath
      },
      fileContent: content
    });
  });

  router.get('/:projectName/tree/*', function (req, res, next) {
    let path = req.params[0];

    let pman = ProjectManager.globalInstance;
    let p = pman.getProjectByName(req.params.projectName);

    if (!p) {
      next();
      return;
    }

    let dirinfo = p.getDirectoryInfo(path);

    if (!dirinfo || dirinfo.entries.length == 0) {
      next();
      return;
    }

    res.render('tree', {
      title: req.params.projectName,
      project: p,
      dir: dirinfo,
      breadcrumb: createBreadCrumb(dirinfo)
    });
  });

  router.get('/:projectName/blob/*', function (req, res, next) {
    let path = req.params[0];

    let pman = ProjectManager.globalInstance;
    let p = pman.getProjectByName(req.params.projectName);

    if (!p) {
      next();
      return;
    }

    let f = p.getFileByPath(p.rootDir + "/" + path);

    if (!f) {
      next();
      return;
    }

    let content = p.getFileContent(f.id);

    if (!content) {
      next();
      return;
    }

    let symrefs = p.listSymbolReferencesInFile(f.id);
    if (symrefs) {
      symrefs.symbolKinds = p.symbolKinds;
      symrefs.symbolFlags = p.symbolFlags;
      symrefs.refFlags = p.symbolReferenceFlags;
    }
    let symdefs = p.listDefinitionsOfSymbolsReferencedInFile(f.id);
    let symdeffiles = {};
    for (const [key, value] of Object.entries(symdefs)) {
      symdeffiles[value.fileid] = p.getFilePath(value.fileid);
    }
    let diagnostics = p.getFileDiagnostics(f.id);
    let includes = p.getFileIncludes(f.id);

    res.render('blob', {
      title: req.params.projectName,
      project: p,
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
