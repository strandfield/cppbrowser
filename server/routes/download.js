
const { ProjectRevision } = require("../src/project.js");
let ProjectManager = require("../src/projectmanager.js");

const Database = require('better-sqlite3');

var express = require('express');

var fs = require('fs');

function DownloadSnapshot(req, res, next) {
  let project = ProjectManager.globalInstance.getProjectByName(req.params.projectName);
  let revision = project?.getRevision(req.params.projectRevision);

  if (!revision) {
    next();
    return;
  }
  
  res.download(revision.path);
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

function createRouter(app) {
  var router = express.Router();
  router.get('/:projectName/:projectRevision', DownloadSnapshot);
  router.get('/:projectName/:projectRevision/*', DownloadFile);
  return router;
}

module.exports = (app) => createRouter(app);
