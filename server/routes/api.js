
const { getSnapshotSymbolInfo } = require("../src/symbol.js");
let ProjectManager = require("../src/projectmanager.js");
const { symbolKinds, diagnosticLevels } = require("@cppbrowser/snapshot-tools"); 

const Database = require('better-sqlite3');

var express = require('express');

var fs = require('fs');

let SITE_BASE_URL = "";
let CAN_DELETE_PROJECT = true;
let CAN_UPLOAD_SNAPSHOT = true;

function GetSiteInfo(req, res, next) {
  res.json({
    'baseUrl': SITE_BASE_URL,
    'permissions': {
      'deleteSnapshot': CAN_DELETE_PROJECT,
      'uploadSnapshot': CAN_UPLOAD_SNAPSHOT
    }
  });
}

function GetSnapshotNames(req, res, next) {
  let snapshots = [];
  let project_manager = ProjectManager.globalInstance;
  for (const name in project_manager.projects) {
    let p = project_manager.getProjectByName(name);
    console.assert(p);
    for (const rev of p.revisions) {
      snapshots.push({
        project: rev.projectName,
        name: rev.name
      });
    }
  }
  res.json(snapshots);
}

function DeleteProjectSnapshots(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);

  if (!project) {
    res.status(404);
    res.json({
      success: false,
      reason: "no such project"
    });
    return;
  }

  if (!CAN_DELETE_PROJECT) {
    res.status(401);
    res.json({
      success: false,
      reason: "permission denied"
    });
    return;
  }

  let filters = req.query.revision ? req.query.revision.split(",") : [];

  let revisions = project.revisions.slice();
  let errcount = 0;
  let removed = {};

  for (const rev of revisions) {
    if (filters.length == 0 || filters.includes(rev.name)) {
      const ok = project.removeRevision(rev);
      removed[rev.name] = errcount;
      if (!ok) {
        ++errcount;
      }
    }
  }

  if (project.revisions.length == 0) {
    ProjectManager.globalInstance.removeProject(project.name);
  }

  res.json({
    success: errcount == 0,
    deleted: removed
  });

  if (errcount == 0) {
    let sindex = req.app.locals.symbolIndex;
    sindex.rebuild();
  }
}

// à tester
function RemoveSnapshot(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);

  if (!revision) {
    next();
    return;
  }

  if (!CAN_DELETE_PROJECT) {
    res.status(401);
    res.json({
      success: false,
      reason: "permission denied"
    });
    return;
  }

  let ok = project.removeRevision(revision);

  if (project.revisions.length == 0) {
    ProjectManager.globalInstance.removeProject(project.name);
  }

  if (ok) {
    let sindex = req.app.locals.symbolIndex;
    sindex.rebuild();
  }

  res.json({
    success: ok
  });
}

function UploadSnapshot(req, res, next) {

  if (!CAN_UPLOAD_SNAPSHOT) {
    res.status(401);
    res.json({
      success: false,
      reason: "permission denied"
    });
    return;
  }

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

  let errmssg = "";

  if (!projectname) {
    errmssg = "missing project name";
  } else {
    let project_manager = ProjectManager.globalInstance;
    let destname = `${projectname}-${projectrevision}.db`;
    let destpath = project_manager.directory + "/" + destname;
    fs.renameSync(req.file.destination + req.file.filename, destpath);
    let ok = project_manager.addProjectRevision(destname);
    if (!ok) {
      fs.rm(destpath, function(err){});
      errmssg = "could not create snapshot";
    }
  }

  if (fs.existsSync(dbPath)) {
    fs.rm(dbPath, function(err){});
  }

  let result = {
    success: (errmssg == "")
  };

  if (result.success) {
    let sindex = req.app.locals.symbolIndex;
    sindex.rebuild();
  }

  if (!result.success) {
    result.reason = errmssg;
  }

  res.json(result);
}

function GetSnapshotFiles(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);

  if (!revision) {
    res.status(404);
    res.json({
      success: false,
      reason: "could not find snapshot"
    });
    return;
  }

  let files = [];

  for (const entry of revision.getAllFilesInHomeFolder()) {
    files.push(entry.path.slice(revision.homeDir.length + 1));
  }

  res.json({
    success: true,
    req: {
      params: {
        projectName: req.params.projectName,
        projectRevision: req.params.projectRevision
      }
    },
    files: files
  });
}

function GetFile(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);
  let path = req.params[0];
  let f = revision?.getFileByPath(revision.homeDir + "/" + path);

  if (!f) {
    res.status(404);
    res.json({
      success: false,
      reason: "no such file"
    });
    return;
  }

  let content = revision.getFileContent(f.id);

  if (!content) {
    res.status(404);
    res.json({
      success: false,
      reason: "file content not available"
    });
    return;
  }

  res.send(Buffer.from(content))
}

function GetFileSema(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);
  let path = req.params[0];
  let f = revision?.getFileByPath(revision.homeDir + "/" + path);

  if (!f) {
    res.status(404);
    res.json({
      success: false,
      reason: "no such file"
    });
    return;
  }

  const symrefs = revision.listSymbolReferencesInFile(f.id);
  const symbols = revision.listSymbolsReferencedInFile(f.id);
  const symdefs = revision.listDefinitionsOfSymbolsReferencedInFile(f.id);
  let symdeffiles = {};
  for (const [key, value] of Object.entries(symdefs)) {
    if (Array.isArray(value)) {
      for (e of value) {
        symdeffiles[e.fileid] = revision.getFilePath(e.fileid);
      }
    } else {
      symdeffiles[value.fileid] = revision.getFilePath(value.fileid);
    }
    
  }
  const diagnostics = revision.getFileDiagnostics(f.id);
  const includes = revision.getFileIncludes(f.id);
  const arguments_passed_by_ref = revision.getArgumentsPassedByReference(f.id);

  res.json({
    success: true,
    file: {
      id: Number(f.id),
      completePath: f.path,
      path: path
    },
    sema: {
      diagnostics: diagnostics.diagnostics,
      includes: includes,
      symrefs: symrefs,
      context: {
        symbols: symbols,
        symdefs: symdefs,
        files: symdeffiles,
      },
      annotations: {
        refargs: arguments_passed_by_ref
      }
    }
  });
}

function GetSnapshotSymbolTreeItem(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);

  if (!revision) {
    res.status(404);
    res.json({
      success: false,
      reason: "could not find snapshot"
    });
    return;
  }

  let symbolId = req.query.symbolId;

  if (symbolId) {
    let symbol = revision.getSymbolById(symbolId);
    
    if (!symbol) {
      res.status(404);
      res.json({
        success: false,
        reason: "could not find symbol",
        symbols: []
      });
      return;
    }

    let children = revision.getChildSymbols(symbol.id);

    children.forEach(child => {
      child.kind = symbolKinds.names[child.kind];
    });

    res.json({
      success: true,
      symbol: {
        id: symbolId,
        name: symbol.name,
        kind: symbolKinds.names[symbol.kind]
      },
      children: children,
    });
  } else {
    let symbols = revision.getProjectTopLevelSymbols();

    symbols.forEach(s => {
      s.kind = symbolKinds.names[s.kind];
    });

    res.json({
      success: true,
      symbols: symbols
    });
  }
}

function GetSnapshotSymbolNameDictionary(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);

  if (!revision) {
    res.status(404);
    res.json({
      success: false,
      reason: "could not find snapshot"
    });
    return;
  }

  let filters = req.query.kind ? req.query.kind.split(",") : symbolKinds.names;

  let dict = {

  };

  for (const key of filters) {
    let rows = revision.getProjectSymbolsEx({kind: key});

    let entries = {
      id: [],
      name: [],
      parent: []
    };

    for (const row of rows) {
      entries.id.push(row.id);
      entries.name.push(row.name);
      entries.parent.push(row.parentId);
    }

    dict[key] = entries;
  }

  res.json({
    success: true,
    params: {
      projectName: req.params.projectName,
      projectRevision: req.params.projectRevision
    },
    dict: dict
  });
}

function GetSnapshotSymbol(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);
  let symbol = revision?.getSymbolById(req.params.symbolId);

  if (!symbol) {
    res.status(404);
    res.json({
      success: false,
      reason: "no such symbol"
    });
    return;
  }

  let info = getSnapshotSymbolInfo(symbol, revision);

  res.json({
    success: true,
    symbol: info
  });
}

function GetSnapshotSymbolDeclarations(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);

  if (!revision) {
    res.status(404);
    res.json({
      success: false,
      reason: "no such revision"
    });
    return;
  }

  let declarations = revision.listSymbolDeclarations(req.params.symbolId);
  for (let decl of declarations) {
    decl.filePath = revision.getFilePath(decl.fileId);
    delete decl.fileId;
  }
  
  res.json({
    success: true,
    symbolId: req.params.symbolId,
    declarations: declarations
  });
}

function GetSnapshotSymbolReferences(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);

  if (!revision) {
    res.status(404);
    res.json({
      success: false,
      reason: "no such revision"
    });
    return;
  }

  let references_by_file = revision.listSymbolReferencesByFile(req.params.symbolId);

  let symbols = {};
  symbols[req.params.symbolId] = revision.getSymbolById(req.params.symbolId);
  for (const file_entry of references_by_file) {
    for (const r of file_entry.references) {
      if (!r.refbySymbolId || symbols[r.refbySymbolId] != undefined) {
        continue;
      }
  
      symbols[r.refbySymbolId] = revision.getSymbolById(r.refbySymbolId);
    }
  }

  res.json({
    success: true,
    symbolId: req.params.symbolId,
    references: references_by_file,
    context: {
      symbols: symbols
    }
  });
}

////////////////////////////
/// File Index functions ///
////////////////////////////

function GetFileIndex(req, res, next) {
  const index = req.app.locals.fileIndex;

  let files = [];

  for (const entry of index.getAllFilesAsArray()) {
    files.push({
      path: entry.filePath,
      projectName: entry.projectName,
      projectRevision: entry.projectVersion.toString()
    });
  }

  res.json({
    success: true,
    files: files
  });
}

////////////////////////////
/// Symbol Index methods ///
////////////////////////////

function GetSymbolIndexDictionary(req, res, next) {
  let sindex = req.app.locals.symbolIndex;

  let filters = req.query.kind ? req.query.kind.split(",") : symbolKinds.names;

  let dict = {

  };

  let select = function(kind) {
    if (kind == 'namespace') {
      return sindex.getNamespaces();
    } else {
      return sindex.getSymbolsByKind(kind);
    }
  }

  for (const key of filters) {
    let rows = select(key);

    let entries = {
      id: [],
      name: [],
      parent: []
    };

    for (const row of rows) {
      entries.id.push(row.id);
      entries.name.push(row.name);
      entries.parent.push(row.parentId);
    }

    dict[key] = entries;
  }

  res.json({
    success: true,
    dict: dict
  });
}

function GetSymbolIndexSourceSnapshots(req, res, next) {
  let sindex = req.app.locals.symbolIndex;
  res.json({
    success: true,
    source: sindex.getSource()
  });
}

function GetSymbolTreeRoot(req, res, next) {
  let sindex = req.app.locals.symbolIndex;
  let top_level_symbols = sindex.getTopLevelSymbols();

  let children = [];

  for (const symbol of top_level_symbols) {
    children.push({
      id: symbol.id,
      name: symbol.name,
      kind: symbolKinds.names[symbol.kind],
      flags: symbol.flags,
      childCount: symbol.childCount ?? 0
    });
  }

  res.json({
    success: true,
    children: children
  });
}

function GetSymbolTreeItem(req, res, next) {
  let sindex = req.app.locals.symbolIndex;
  let symbol = sindex.getSymbolById(req.params.symbolId);

  if (!symbol) {
    res.json({
      success: false,
      reason: "no such symbol",
    });
    return;
  }

  let children = [];

  for (const child of sindex.getSymbolChildren(symbol)) {
    children.push({
      id: child.id,
      name: child.name,
      kind: symbolKinds.names[child.kind],
      childCount: child.childCount ?? 0
    });
  }

  res.json({
    success: true,
    symbol: {
      id: symbol.id,
      parentId: symbol.parentId,
      name: symbol.name,
      kind: symbolKinds.names[symbol.kind]
    },
    children: children
  });
}

function GetSymbolIndexSymbol(req, res, next) {
  let sindex = req.app.locals.symbolIndex;
  let info = sindex.getSymbolInfo(req.params.symbolId);

  if (!info) {
    res.status(404);
    res.json({
      success: false,
      reason: "no such symbol",
    });
    return;
  }

  res.json({
    success: true,
    symbol: info
  });
}

function GetSymbolIndexSymbolReferences(req, res, next) {
  let sindex = req.app.locals.symbolIndex;
  let symbol = sindex.getSymbolById(req.params.symbolId);

  if (!symbol) {
    res.status(404);
    res.json({
      success: false,
      reason: "no such symbol",
    });
    return;
  }

  let project_filters = req.query.project?.split(",") ?? [];
  let version_filters = req.query.version?.split(",") ?? [];

  let result = [];

  let sources = sindex.getSource();
  for (const source of sources) {
    let project_name = source.project;
    
    if (project_filters.length > 0 && !project_filters.includes(project_name)) {
      continue;
    }

    let refs_in_snapshots = [];

    for (const project_version of source.versions) {
      if (version_filters.length > 0 && !version_filters.includes(project_version)) {
        continue;
      }

      let snapshot = sindex.getSnapshot(project_name, project_version);

      if (!snapshot) {
        console.error("bad");
        continue;
      }

      let refs = snapshot.listSymbolReferencesByFile(symbol.id);
      if (refs.length > 0 || version_filters.length > 0) {
        refs_in_snapshots.push({
          version: project_version,
          result: refs
        });
      }
    }

    if (refs_in_snapshots.length > 0 || project_filters.length > 0) {
      result.push({
        project: project_name,
        versions: refs_in_snapshots
      });
    }
  }

  res.json({
    success: true,
    result: result,
  });
}

////////////////////////////
/// misc methods         ///
////////////////////////////

function GetDiagnosticLevels(req, res, next) {
  res.json(diagnosticLevels);
}

////////////////////////////
/// createRouter()       ///
////////////////////////////

function createRouter(app) {
  SITE_BASE_URL = app.locals.site.baseUrl;
  CAN_DELETE_PROJECT = app?.conf?.features?.deleteProject ?? true;
  CAN_UPLOAD_SNAPSHOT = app?.conf?.features?.upload ?? true;

  var router = express.Router();

  router.get('/site/info', GetSiteInfo);
  router.get('/snapshots', GetSnapshotNames);

  router.delete('/snapshots/:projectName', DeleteProjectSnapshots);
  router.delete('/snapshots/:projectName/:projectRevision', RemoveSnapshot);
  
  // upload
  {
    const multer  = require('multer');
    const upload = multer({ dest: './public/data/uploads/' });
    router.post("/snapshots", upload.single('database'), UploadSnapshot);
  }

  // file-related routes
  router.get('/snapshots/:projectName/:projectRevision/files', GetSnapshotFiles);
  router.get('/snapshots/:projectName/:projectRevision/files/*', GetFile);
  router.get('/snapshots/:projectName/:projectRevision/sema/*', GetFileSema);

  // symbol-related routes
  router.get('/snapshots/:projectName/:projectRevision/symbols/tree', GetSnapshotSymbolTreeItem);
  router.get('/snapshots/:projectName/:projectRevision/symbols/dict', GetSnapshotSymbolNameDictionary);
  router.get('/snapshots/:projectName/:projectRevision/symbols/:symbolId', GetSnapshotSymbol);
  router.get('/snapshots/:projectName/:projectRevision/symbols/:symbolId/declarations', GetSnapshotSymbolDeclarations);
  router.get('/snapshots/:projectName/:projectRevision/symbols/:symbolId/references', GetSnapshotSymbolReferences);

  // file-index related routes
  router.get('/files', GetFileIndex);

  // symbol index related routes
  router.get('/symbols/dict', GetSymbolIndexDictionary);
  router.get('/symbols/snapshots', GetSymbolIndexSourceSnapshots);
  router.get('/symbols/tree', GetSymbolTreeRoot);
  router.get('/symbols/tree/:symbolId', GetSymbolTreeItem);
  router.get('/symbols/:symbolId', GetSymbolIndexSymbol);
  router.get('/symbols/:symbolId/references', GetSymbolIndexSymbolReferences);

  // misc
  router.get('/meta/diagnosticLevels', GetDiagnosticLevels);

  return router;
}

module.exports = (app) => createRouter(app);
