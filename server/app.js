var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var ini = require('ini');
var fs = require('node:fs');

var app = express();

//console.log(process.env.APPDATA);
//console.log(process.env.LOCALAPPDATA);

function parseCommandLine(args = null) {
  if (!args) {
    args = process.argv.slice(2);
  }
  let result = { };
  
  for (let i = 0; i < args.length; ) {
    if (args[i] == "-c" || args[i] == "--config") {
      result.config = args[i+1];
      i = i+2;
    } else if(args[i] == "--custom-path") {
      result.custom_path = args[i+1];
      i = i+2;
    } else {
      console.log(`Unknown command line argument: ${args[i]}`);
      process.exit(1);
    }
  }

  return result;
}

let cli = parseCommandLine();

let defaultCustomPath = path.join(process.cwd(), 'custom');
let CustomPath = defaultCustomPath;
if (process.env.CPPBROWSER_CUSTOM) {
  CustomPath = process.env.CPPBROWSER_CUSTOM;
}
if (cli.custom_path) {
  CustomPath = cli.custom_path;
}
if (CustomPath != defaultCustomPath) {
  if (!fs.existsSync(CustomPath)) {
    console.log(`User-specified custom path "${CustomPath}" does not exist`);
    process.exit(1);
  }
}
console.log(`Custom path is ${CustomPath}`);

function parseConf() {
  let confpath = null;
  let custom_path_conf = path.join(CustomPath, "conf/app.ini");
  if (fs.existsSync(custom_path_conf)) {
    confpath = custom_path_conf;
  }

  if (cli.config) {
    if (!fs.existsSync(cli.config)) {
      console.log(`User-specified config file "${cli.config}" does not exist`);
      process.exit(1);
    }

    confpath = cli.config;
  }

  if (confpath) {
    console.log(`Reading config from ${confpath}`);
    const text = fs.readFileSync(confpath, 'utf8');
    return ini.parse(text);
  } else {
    return null;
  }
}

let conf = parseConf();

var ProjectManager = require("./src/projectmanager");

let snaphostsPath = conf?.snapshots?.root ?? path.join(__dirname, "data/snapshots");
console.log(`Initializing project manager with path ${snaphostsPath}`);
ProjectManager.initGlobalInstance(snaphostsPath);

app.conf = conf;

const SymbolIndex = require("./src/symbolindex");
app.locals.symbolIndex = new SymbolIndex();
console.log("Building symbol index...");
app.locals.symbolIndex.build(ProjectManager.globalInstance);
console.log("Done!");

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

if (conf?.features?.upload ?? true) {
  console.log("Snapshot upload is enabled");
}

app.locals.restApi = {
  baseUrl: "/api"
};
app.locals.site = {
  baseUrl: "/ui/static"
};

// API routes
var apiRouter = require('./routes/api')(app);
app.use(app.locals.restApi.baseUrl, apiRouter);

// Download routes
app.use("/download", require('./routes/download')(app));

// Static UI routes
var indexRouter = require('./routes/index')(app);
app.use(app.locals.site.baseUrl, express.static(path.join(__dirname, 'public')));
app.use(app.locals.site.baseUrl, express.static(path.join(__dirname, 'dist')));
app.use(app.locals.site.baseUrl, indexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
