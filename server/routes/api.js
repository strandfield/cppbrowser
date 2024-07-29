
const { ProjectRevision } = require("../src/project.js");
let ProjectManager = require("../src/projectmanager.js");

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

  res.json({
    success: ok
  });
}

// à tester
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
    files: files
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

    let children = revision.getChildSymbolsEx(symbol.id);

    res.json({
      success: true,
      symbols: children,
    });
  } else {
    let symbols = revision.getTopLevelSymbols();

    res.json({
      success: true,
      symbols: symbols,
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

  // let names = [];
  // let symbols = revision.selectNonLocalDefinedSymbols();

  // for (const symbol of symbols) {
  //   names.push([symbol.name, symbol.kind, symbol.id]);
  // }

  let names = Array.from({ length: 28 }, v => []);
  let symbols = revision.selectNonLocalDefinedSymbols();

  for (const symbol of symbols) {
    names[symbol.kind].push(symbol.name, symbol.id);
  }

  res.json({
    success: true,
    names: names,
  });
}

function createRouter(app) {

  SITE_BASE_URL = app.locals.site.baseUrl;
  CAN_DELETE_PROJECT = app?.conf?.features?.deleteProject ?? true;
  CAN_UPLOAD_SNAPSHOT = app?.conf?.features?.upload ?? true;

  var router = express.Router();

  router.get('/site/info', GetSiteInfo);
  router.get('/snapshots', GetSnapshotNames);

  router.delete('/snapshots/:projectName/:projectRevision', RemoveSnapshot);
  
  // upload
  {
    const multer  = require('multer');
    const upload = multer({ dest: './public/data/uploads/' });
    router.post("/snapshots", upload.single('database'), UploadSnapshot);
  }

  // file-related routes
  router.get('/snapshots/:projectName/:projectRevision/files', GetSnapshotFiles);

  // symbol-related routes
  router.get('/snapshots/:projectName/:projectRevision/symbols/tree', GetSnapshotSymbolTreeItem);
  router.get('/snapshots/:projectName/:projectRevision/symbols/dict', GetSnapshotSymbolNameDictionary);

  return router;
}

module.exports = (app) => createRouter(app);
