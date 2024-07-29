
const { ProjectRevision } = require("../src/project.js");
let ProjectManager = require("../src/projectmanager.js");

const Database = require('better-sqlite3');

var express = require('express');

var fs = require('fs');

let SITE_BASE_URL = "";
let CAN_DELETE_PROJECT = true;
let CAN_UPLOAD_SNAPSHOT = true;

function createBreadCrumb(project, revision, dir) {
  let result = [];

  result.push({
    type: 'revision',
    name: revision.name
  });

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

function createBreadCrumbForRevision(project, revision) {
  return [{
    type: 'current',
    name: revision.name
  }];
}

function createBreadCrumbForFile(project, revision, filepath) {
  let i = filepath.lastIndexOf('/');
  if (i != -1) {
    return createBreadCrumb(project, revision, {
      name: filepath.substring(i+1),
      parent_path: filepath.substring(0, i)
    });
  } else {
    return createBreadCrumb(project, revision, {
      name: filepath
    });
  }
}

function createBreadCrumbForSymbol(project, revision, symbol) {
  return [{
    type: 'revision',
    name: revision.name
  }, {
    type: 'current',
    name: "#" + symbol.id
  }];
}

function GetIndex(req, res, next) {
  let projects = [];
  let project_manager = ProjectManager.globalInstance;
  for (const name in project_manager.projects) {
    let p = project_manager.getProjectByName(name);
    if (p) {
      projects.push(p);
    }
  }
  res.render("index", {
    title: "Home",
    projects: projects,
    canDelete: CAN_DELETE_PROJECT,
    canUpload: CAN_UPLOAD_SNAPSHOT
  });
}

function GetProject(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);

  if (!project) {
    next();
    return;
  }

  res.render("project", {
    title: req.params.projectName,
    project: project,
    canDelete: CAN_DELETE_PROJECT
  });
}

function GetProjectRevision(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);

  if (!project) {
    next();
    return;
  }

  let revision = project.getRevision(req.params.projectRevision);

  if (!revision) {
    next();
    return;
  }

  let dirinfo = revision.getDirectoryInfo(revision.homeDir);

  if (!dirinfo) {
    next();
    return;
  }

  res.render("tree", {
    title: req.params.projectName,
    project: project,
    projectRevision: revision,
    directory: dirinfo,
    breadcrumb: createBreadCrumbForRevision(project, revision)
  });
}

function GetFileOrDirectory(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);

  if (!project) {
    next();
    return;
  }

  let revision = project.getRevision(req.params.projectRevision);

  if (!revision) {
    next();
    return;
  }

  let path = req.params[0];

  let dirinfo = revision.getDirectoryInfo(path);

  if (dirinfo) {
    res.render("tree", {
      title: req.params.projectName,
      project: project,
      projectRevision: revision,
      directory: dirinfo,
      breadcrumb: createBreadCrumb(project, revision, dirinfo)
    });

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

  res.render("blob", {
    title: req.params.projectName,
    project: project,
    projectRevision: revision,
    breadcrumb: createBreadCrumbForFile(project, revision, path),
    file: {
      id: f.id,
      path: f.path,
      relativePath: path, 
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
}

function GetProjectTopLevelSymbols(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);

  if (!revision) {
    next();
    return;
  }

  let symbols = revision.getTopLevelSymbols();

  res.render("symbol", {
    title: req.params.projectName,
    project: project,
    projectRevision: revision,
    symbols: symbols,
    symbol: null,
    breadcrumb: createBreadCrumbForFile(project, revision, "Symbols")
  });
}

function GetProjectSymbol(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);
  let symbol = revision?.getSymbolById(req.params.symbolId);

  if (!symbol) {
    next();
    return;
  }

  symbol.kind = revision.symbolKinds[symbol.kind];

  if (symbol.kind == 'class' || symbol.kind == 'struct') {
    symbol.baseClasses = revision.getBaseClasses(symbol.id);
    symbol.derivedClasses = revision.getDerivedClasses(symbol.id);
  }

  let children = revision.getChildSymbols(symbol.id);

  let namespacekind = revision.getSymbolKindValue('namespace');
  symbol.namespaces = children.filter(e => e.kind == namespacekind);
  symbol.namespaces.sort((a,b) => a.name.localeCompare(b.name));

  let classkind = revision.getSymbolKindValue('class');
  let structkind = revision.getSymbolKindValue('struct');
  let unionkind = revision.getSymbolKindValue('union');
  symbol.records = children.filter(e => e.kind == classkind || e.kind == structkind || e.kind == unionkind);
  symbol.records.sort((a,b) => a.name.localeCompare(b.name));

  let functionkind = revision.getSymbolKindValue('function');
  symbol.functions = children.filter(e => e.kind == functionkind);
  symbol.functions.sort((a,b) => a.name.localeCompare(b.name));

  let ctorkind = revision.getSymbolKindValue('constructor'); 
  symbol.constructors = children.filter(e => e.kind == ctorkind);

  let dtorkind = revision.getSymbolKindValue('destructor'); 
  symbol.destructors = children.filter(e => e.kind == dtorkind);

  let fieldkind = revision.getSymbolKindValue('field'); 
  symbol.fields = children.filter(e => e.kind == fieldkind);
  symbol.fields.sort((a,b) => a.name.localeCompare(b.name));

  let methodkind = revision.getSymbolKindValue('instance-method'); 
  symbol.methods = children.filter(e => e.kind == methodkind);
  symbol.methods.sort((a,b) => a.name.localeCompare(b.name));

  symbol.children = children;

  if (symbol.parentId) {
    symbol.parent = revision.getSymbolById(symbol.parentId);
    if (symbol.parent) {
      symbol.parent.kind = revision.symbolKinds[symbol.parent.kind];
    }
  }

  symbol.references = revision.listSymbolReferencesByFile(symbol.id);

  let defs = [];
  for (const refsInFile of symbol.references) {
    for (const symref of refsInFile.references) {
      if (symref.flags & 2) {
        let e = {
          filePath: refsInFile.file
        };
        Object.assign(e, symref);
        defs.push(e);
      }
    }
  }

  symbol.definitions = defs;

  res.render("symbol", {
    title: req.params.projectName,
    project: project,
    projectRevision: revision,
    symbols: null,
    symbol: symbol,
    breadcrumb: createBreadCrumbForSymbol(project, revision, symbol)
  });
}

function DownloadFile(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);
  let path = req.params[0];
  let file = revision.getFileByPath(revision.homeDir + "/" + path);

  if (!file) {
    next();
    return;
  }
  
  let content = revision.getFileContent(file.id);
  res.attachment(path);
  res.send(content);
}

function ViewFileRaw(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);
  let path = req.params[0];
  let file = revision.getFileByPath(revision.homeDir + "/" + path);

  if (!file) {
    next();
    return;
  }
  
  let content = revision.getFileContent(file.id);
  res.set('Content-Type', 'text/plain');
  res.send(content);
}

function RemoveProjectRevision(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);

  if (!revision) {
    next();
    return;
  }

  project.removeRevision(revision);

  if (project.revisions.length > 0) {
    res.redirect(`${SITE_BASE_URL}/${project.name}`);
  } else {
    ProjectManager.globalInstance.removeProject(project.name);
    res.redirect(`${SITE_BASE_URL}/index.html`);
  }
}

function RemoveProject(req, res, next) {
  let projectmanager = ProjectManager.globalInstance;
  projectmanager.removeProject(req.params.projectName);
  res.redirect(`${SITE_BASE_URL}/index.html`);
}

function GetUploadPage(req, res, next) {
  res.render("upload", {
    canUpload: CAN_UPLOAD_SNAPSHOT
  });
}

function UploadSnapshot(req, res, next) {
  let dboptions = {
    readonly: false,
    fileMustExist: true
  };
  let dbPath = req.file.destination + req.file.filename;
  let db = new Database(dbPath, dboptions);

  console.log(req.file);
  console.log(JSON.stringify(req.body));

  let projectname = req.body?.projectname;

  if (typeof(projectname) == 'string' && projectname != "") {
    let stmt = db.prepare("INSERT OR REPLACE INTO info(key,value) VALUES(?,?)");
    stmt.run("project.name", projectname);
  } else {
    projectname = db.prepare("SELECT value FROM info WHERE key = ?").get("project.name")?.value;
  }

  let projectrevision = req.body?.projectrevision;

  if (typeof(projectrevision) == 'string' && projectrevision != "") {
    let stmt = db.prepare("INSERT OR REPLACE INTO info(key,value) VALUES(?,?)");
    stmt.run("project.version", projectrevision);
  } else {
    projectrevision = db.prepare("SELECT value FROM info WHERE key = ?").get("project.version")?.value;
  }

  db.close();

  let success = true;

  if (!projectname) {
    success = false;
  } else {
    let project_manager = ProjectManager.globalInstance;
    let destname = `${projectname}-${projectrevision}.db`;
    let destpath = project_manager.directory + "/" + destname;
    fs.renameSync(req.file.destination + req.file.filename, destpath);
    success = project_manager.addProjectRevision(destname);
    if (!success) {
      fs.rm(destpath, function(err){});
    }
  }

  if (fs.existsSync(dbPath)) {
    fs.rm(dbPath, function(err){});
  }

  res.render("upload", {
    uploadResult: {
      success: success
    }
  });
}

function GetSymbolIndex(req, res, next) {
  let sindex = req.app.locals.symbolIndex;
  let symbols = sindex.getTopLevelSymbols();
  symbols.sort((a,b) => a.name.localeCompare(b.name));

  res.render("symbols/index", {
    title: "Symbol Index",
    symbols: symbols
  });
}

function GetSymbolByID(req, res, next) {
  let symbol_index = req.app.locals.symbolIndex;
  let symbol = symbol_index.getSymbolById(req.params.symbolId);

  if (!symbol) {
    return next();
  }

  let parent = symbol.parentId ? symbol_index.getSymbolById(symbol.parentId) : null;

  let children = symbol_index.getSymbolChildren(symbol);

  children.sort((a,b) => a.name.localeCompare(b.name));

  let references = symbol_index.listSymbolReferences(symbol.id);

  res.render("symbols/page", {
    title: symbol.displayName ?? symbol.name,
    symbol: symbol,
    parent: parent,
    children: children,
    references: references,
    SymbolKindNamespace: 2,
    SymbolKindStruct: 6,
    SymbolKindClass: 7
  });
}

function createRouter(app) {

  SITE_BASE_URL = app.locals.site.baseUrl;
  CAN_DELETE_PROJECT = app?.conf?.features?.deleteProject ?? true;
  CAN_UPLOAD_SNAPSHOT = app?.conf?.features?.upload ?? true;

  var router = express.Router();

  router.get('/index.html', GetIndex);

  router.get('/download/:projectName/:projectRevision/*', DownloadFile);
  router.get('/raw/:projectName/:projectRevision/*', ViewFileRaw);

  if (CAN_DELETE_PROJECT) {
    router.get('/delete/:projectName/:projectRevision', RemoveProjectRevision);
    router.get('/delete/:projectName', RemoveProject);
  }

  router.get('/upload.html', GetUploadPage);
  if (CAN_UPLOAD_SNAPSHOT) {
    const multer  = require('multer');
    const upload = multer({ dest: './public/data/uploads/' });
    router.post("/upload.html", upload.single('database'), UploadSnapshot);
  }

  router.get("/symbols.html", GetSymbolIndex);
  router.get("/symbols/:symbolId", GetSymbolByID);
  
  router.get('/:projectName', GetProject);
  router.get('/:projectName/:projectRevision', GetProjectRevision);
  router.get('/:projectName/:projectRevision/symbols.html', GetProjectTopLevelSymbols);
  router.get('/:projectName/:projectRevision/symbols/:symbolId', GetProjectSymbol);
  router.get('/:projectName/:projectRevision/*', GetFileOrDirectory);

  return router;
}

module.exports = (app) => createRouter(app);
