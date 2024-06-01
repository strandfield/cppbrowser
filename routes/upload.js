var express = require('express');
var router = express.Router();

const multer  = require('multer');
const upload = multer({ dest: './public/data/uploads/' });

var fs = require('fs');
var ProjectManager = require("../src/projectmanager");
const Database = require('better-sqlite3');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.render('upload', {});
});

router.post('/', upload.single('database'), function(req, res, next) {
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

  db.close();

  let success = true;

  if (!projectname) {
    success = false;
  } else {
    let destname = projectname + ".db";
    let destpath = ProjectManager.globalInstance.directory + "/" + destname;
    fs.renameSync(req.file.destination + req.file.filename, destpath);
    let pro = ProjectManager.globalInstance.addProject(destname);
    success = (pro != null);
    if (!success) {
      fs.rm(destpath, function(err){});
    }
  }

  if (fs.existsSync(dbPath)) {
    fs.rm(dbPath, function(err){});
  }

  // res.json({
  //   success: true 
  // });

  res.render('upload', {
    uploadResult: {
      success: success
    }
  });
});

module.exports = router;
