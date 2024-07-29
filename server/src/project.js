

const Database = require('better-sqlite3');

const Path = require('node:path');
var fs = require('fs');
const { assert } = require('node:console');


class ProjectVersion
{
    major;
    minor;
    patch;
    suffix;

    constructor(name) {
        let suffixindex = name.indexOf("-");
        if (suffixindex != -1) {
            this.suffix = name.slice(suffixindex+1);
            name = name.slice(0, suffixindex);
        }
        let segments = name.split(".");
        
        this.major = Number.parseInt(segments[0]);

        if (segments.length >= 2) {
            this.minor = Number.parseInt(segments[1]);
            if (segments.length >= 3) {
                this.patch = Number.parseInt(segments[2]);
                if (segments.length > 3) {
                    throw `too many segments in version number ${name}`;
                }
            }
        }
    }

    toString() {
        let v = `${this.major}`;

        if (this.minor != null) {
            v += `.${this.minor}`;
        }

        if (this.patch != null) {
            v += `.${this.patch}`;
        }

        if (this.suffix) {
            v += `-${this.suffix}`;
        }

        return v;
    }

    static eq(a, b) {
        return a.major == b.major && a.minor == b.minor && a.patch == b.patch && a.suffix == b.suffix;
    }

    static comp(a, b) {
        if (a.major != b.major) {
            return a.major - b.major;
        }

        if (a.minor != null && b.minor == null) {
            return 1;
        } else if (a.minor == null && b.minor != null) {
            return -1;
        } else if (a.minor != null && b.minor != null) {
            if (a.minor != b.minor) {
                return a.minor - b.minor;
            }
        }

        if (a.patch != null && b.patch == null) {
            return 1;
        } else if (a.patch == null && b.patch != null) {
            return -1;
        } else if (a.patch != null && b.patch != null) {
            if (a.patch != b.patch) {
                return a.patch - b.patch;
            }
        }

        return 0;
    }
};

class ProjectRevision
{
    constructor(dbPath) {

        let options = {
            readonly: true,
            fileMustExist: true
          };          

        this.path = dbPath;
        this.db = new Database(dbPath, options);

        this.properties = this.readProperties();

        if (!this.properties.project?.name) {
            throw `missing project name in ${Path.parse(dbPath).name}.db`;
        }

        this.projectName = this.properties.project.name;

        if (!this.properties.project.version) {
            throw `missing project version in ${Path.parse(dbPath).name}.db`;
        }

        this.name = this.properties.project.version;
        this.projectVersion = new ProjectVersion(this.name);

        this.homeDir = this.properties.project?.home;
        if (!this.homeDir) {
            this.homeDir = this.#getHomeDirFromFiles();
        }

        this.files = {};
        this.maxfileid = 0;

        let rows = this.db.prepare('SELECT id, path FROM file').all();
        for (let r of rows) {
            this.files[r.id] = r.path.replaceAll('\\', '/');
            this.maxfileid = Math.max(r.id, this.maxfileid);
        }

        this.diagnosticLevels = this.#readDiagnosticLevels();
        this.accessSpecifiers = this.#readAccessSpecifiers();
        this.symbolKinds = this.#readSymbolKinds();
        this.symbolFlags = this.#readSymbolFlags();
        this.symbolReferenceFlags = this.#readSymbolReferenceFlags();
    }

    static open(dbPath) {
        return new ProjectRevision(dbPath);
    }

    static destroy(instance) {
        instance.db.close();
        fs.rm(instance.path, function(err) {
            if (err) {
                console.log(err);
            }
        });
    }

    readProperty(name, defaultValue = undefined) {
        let row = this.db.prepare("SELECT value FROM info WHERE key = ?").get(name);
        return row ? row.value : defaultValue;
    }

    readProperties() {
        let result = {};
        let rows = this.db.prepare("SELECT key, value FROM info").all();
        for (const row of rows) {
            let parts = row.key.split('.');
            let key = parts[parts.length - 1];
            parts = parts.slice(0, parts.length - 1);
            let current = result;
            for (const p of parts) {
                if (!current[p]) {
                    current[p] = {};
                }
                current = current[p];
            }
            current[key] = row.value;
        }
        return result;
    }

    #getHomeDirFromFiles() {
        let rows = this.db.prepare('SELECT path FROM file WHERE content IS NOT NULL').all();
        if (rows.length == 0) {
            return null;
        }
        let home_path = rows[0].path;
        let isinfolder = function(filepath, dirpath) {
            return filepath.length > dirpath.length
                && filepath.startsWith(dirpath)
                && filepath[dirpath.length] == '/';
        }
        for (const row of rows) {
            while (home_path.length > 0 && !isinfolder(row.path, home_path)) {
                let i = home_path.lastIndexOf('/');
                if (i == -1) {
                    home_path = "";
                } else {
                    home_path = home_path.substring(0, i);
                }
            }
        }

        if (home_path == "/") {
            home_path = "";
        }

        return home_path;
    }

    getFileByPath(searchPath) {
        for (const [fileid, filepath] of Object.entries(this.files)) {
            if (filepath == searchPath) {
                return {
                    id: fileid,
                    path: filepath
                };
            }
        }

        return null;
    }

    getDirectoryInfo(dirpath) {
        if (!dirpath.endsWith('/')) {
            dirpath += '/'
        }

        let allfiles = this.getAllFilesInHomeFolder();

        let files = [];
        let dirnames = new Set();

        let dirname = dirpath.substring(dirpath.lastIndexOf('/', dirpath.length-2), dirpath.length-1);
        if (dirname == "") {
            dirname = "/";
        } else if (dirname.length > 1 && dirname.startsWith("/")) {
            dirname = dirname.substring(1);
        }

        if (!dirpath.startsWith(this.homeDir)) {
            dirpath = this.homeDir + '/' + dirpath;
        }

        let dirrelpath = dirpath.substring(this.homeDir.length + 1);
        while (dirrelpath.endsWith('/')) {
            dirrelpath = dirrelpath.substring(0, dirrelpath.length - 1);
        }

        for (const file of allfiles) {
            if (!file.path.startsWith(dirpath)) {
                continue;
            }

            let path = file.path;
            if (path.indexOf('/', dirpath.length) != -1) {
                let i = path.indexOf('/', dirpath.length);
                dirnames.add(path.substring(dirpath.length, i));
            } else {
                files.push({
                    type: 'file',
                    name: path.substring(dirpath.length),
                    path: path.substring(this.homeDir.length + 1),
                    id: file.id
                });
            }
        }

        let entries = [];

        for (const item of dirnames) {
            entries.push({
                type: 'dir',
                name: item,
                path: dirpath.substring(this.homeDir.length + 1) + item
            });
        }

        for (const item of files) {
            entries.push(item);
        }

        // ugly
        if (entries.length == 0) {
            return null;
        }

        let result = {
            name: dirname,
            path: dirrelpath,
            entries: entries
        };

        if (dirrelpath.lastIndexOf('/') != -1) {
            result.parent_path = dirrelpath.substring(0, dirrelpath.lastIndexOf('/'));
        }

        return result;
    }

    getDirectoryEntries(dirpath) {
        let info = this.getDirectoryInfo(dirpath);
        return info?.entries;
    }

    
    getAllFilesInHomeFolder() {
        let result = [];

        for (const [fileid, filepath] of Object.entries(this.files)) {
            // todo: fixme, use a dedicated function for testing if file is in dir
            if (filepath.startsWith(this.homeDir)) {
                result.push({
                    id: fileid,
                    path: filepath
                });
            }
        }

        return result;
    }

    getAllFilesWithContent() {
        let rows = this.db.prepare("SELECT id, path FROM file WHERE content IS NOT NULL").all();

        let result = [];

        for (const row of rows) {
            result.push({
                id: Number(row.id),
                path: row.path
            });
        }

        return result;
    }

    getFilePath(id) {
        return this.files[id].substring(this.homeDir.length + 1);
    }

    getFileContent(fileid) {
        let row = this.db.prepare("SELECT content FROM file WHERE id = ?").get(fileid);
        return row?.content;
    }

    getFileIncludes(fileid) {
        let rows = this.db.prepare("SELECT line, included_file_id FROM include WHERE file_id = ?").all(fileid);

        let result = [];

        for (const row of rows) {
            let incfileid = Number(row.included_file_id);
            let incfilepath = this.files[incfileid];

            // todo: fixme, use a dedicated function for testing if file is in dir
            if (incfilepath.startsWith(this.homeDir)) {
                result.push({
                    line: Number(row.line),
                    included: {
                        id: incfileid,
                        path: incfilepath.substring(this.homeDir.length + 1)
                    }
                });
            }
        }

        return result;
    }

    getFileDiagnostics(fileid) {
        let rows = this.db.prepare("SELECT level, line, column, message FROM diagnostic WHERE fileID = ?").all(fileid);

        let diagnostics = [];

        for (const row of rows) {
            diagnostics.push({
                level: Number(row.level),
                line: Number(row.line),
                message: row.message
            });
        }

        return {
            fileId: fileid,
            diagnosticLevels: this.diagnosticLevels,
            diagnostics: diagnostics
        };
    }

    static #convertBigIntToHex(val) {
        if (val < 0) {
            val = val + 18446744073709551616n;
        } 
        
        return val.toString(16);
    }

    #readSymbol(row) {
        if (!row) {
            return null;
        }

        let symbol = {
            id: ProjectRevision.#convertBigIntToHex(row.id),
            kind: Number(row.kind),
            name: row.name
        };

        if (row.parent) {
            symbol.parentId = ProjectRevision.#convertBigIntToHex(row.parent);
        }

        if (row.displayname) {
            symbol.displayName = row.displayname;
        }

        if (row.flags) {
            symbol.flags = Number(row.flags);
        }

        if (row.parameterIndex) {
            symbol.parameterIndex = Number(row.parameterIndex);
        }

        if (row.type) {
            symbol.type = row.type;
        }

        if (row.value) {
            symbol.value = row.value;
        }

        return symbol;
    }

    #readSymbols(rows) {
        let list = [];
        for (let r of rows) {
            list.push(this.#readSymbol(r));
        }
        return list;
    }

    #readSymbolsAsDict(rows) {
        let result = {};
        for (let r of rows) {
            let s = this.#readSymbol(r);
            if (s) {
                result[s.id] = s;
            }
        }
        return result;
    }

    static #convertSymbolIdFromHex(hex) {
        let idint = BigInt("0x" + hex);
        if (idint > 9223372036854775807n) {
            idint = idint - 18446744073709551616n;
        }
        return idint;
    }

    getSymbolById(idhex) {
        let idint = ProjectRevision.#convertSymbolIdFromHex(idhex);
        let stmt = this.db.prepare("SELECT id, kind, parent, name, displayname, flags, parameterIndex, type, value FROM symbol WHERE id = ?");
        stmt.safeIntegers();
        let row = stmt.get(idint);
        return this.#readSymbol(row);
    }

    getSymbolByName(name) {
        let stmt = this.db.prepare("SELECT id, kind, parent, name, displayname, flags, parameterIndex, type, value FROM symbol WHERE name = ?");
        stmt.safeIntegers();
        let row = stmt.get(name);
        return this.#readSymbol(row);
    }

    getChildSymbols(parentid) {
        parentid = ProjectRevision.#convertSymbolIdFromHex(parentid);
        let stmt = this.db.prepare("SELECT id, kind, parent, name, displayname, flags, parameterIndex, type, value FROM symbol WHERE parent = ?");
        stmt.safeIntegers();
        let rows = stmt.all(parentid);
        return this.#readSymbols(rows);
    }

    getChildSymbolsEx(parentid, fields = "") {
        parentid = ProjectRevision.#convertSymbolIdFromHex(parentid);
        let q = "";
        if (fields.length > 0) {
            q = `SELECT id, kind, name, displayname, ${fields} FROM symbol WHERE parent = ?`;
        } else {
            q = "SELECT id, kind, name, displayname FROM symbol WHERE parent = ?";
        }
        let stmt = this.db.prepare(q);
        stmt.safeIntegers();
        let rows = stmt.all(parentid);
        return this.#readSymbols(rows);
    }

    getTopLevelSymbols() {
        let stmt = this.db.prepare("SELECT id, kind, name, displayname, flags, parameterIndex, type, value FROM symbol WHERE parent IS NULL");
        stmt.safeIntegers();
        let rows = stmt.all();
        return this.#readSymbols(rows);
    }
    
    selectNonLocalDefinedSymbols() {
        let query = `SELECT id, kind, parent, name, displayname, flags, parameterIndex, type, value 
        FROM symbol WHERE (symbol.id IN (SELECT symbol_id FROM symbolDefinition) OR symbol.kind = 2) AND (flags & 1 = 0)`;

        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        let rows = stmt.all();
        return this.#readSymbols(rows);
    }

    getBaseClasses(symbolId) {
        symbolId = ProjectRevision.#convertSymbolIdFromHex(symbolId);
        let stmt = this.db.prepare("SELECT baseOf.access AS access, baseOf.baseClassID AS baseClassID, symbol.name AS name FROM baseOf LEFT JOIN symbol ON baseOf.baseClassID = symbol.id WHERE baseOf.derivedClassID = ?");
        stmt.safeIntegers();
        let rows = stmt.all(symbolId);
        let result = [];

        for (const row of rows) {
            let element = {
                access: Number(row.access),
                baseClassID: ProjectRevision.#convertBigIntToHex(row.baseClassID),
                name: row.name
            };
            result.push(element);
        }

        return result;
    }

    getDerivedClasses(symbolId) {
        symbolId = ProjectRevision.#convertSymbolIdFromHex(symbolId);
        let stmt = this.db.prepare("SELECT baseOf.derivedClassID AS derivedClassID, symbol.name AS name FROM baseOf LEFT JOIN symbol ON baseOf.derivedClassID = symbol.id WHERE baseOf.baseClassID = ?");
        stmt.safeIntegers();
        let rows = stmt.all(symbolId);
        let result = [];

        for (const row of rows) {
            let element = {
                derivedClassID: ProjectRevision.#convertBigIntToHex(row.derivedClassID),
                name: row.name
            };
            result.push(element);
        }

        return result;
    }

    getSymbolKindValue(text) {
        return this.symbolKinds.indexOf(text);
    }

    listSymbolReferences(symbolId) {
        symbolId = ProjectRevision.#convertSymbolIdFromHex(symbolId);
        let query = `SELECT file_id, line, col, parent_symbol_id, flags FROM symbolReference WHERE symbol_id = ?
          ORDER BY file_id, line, col ASC`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        let rows = stmt.all(symbolId);

        let result = [];
        for (const row of rows) {
            result.push({
                fileId: Number(row.file_id),
                line: Number(row.line),
                col: Number(row.col),
                parent_symbol_id: row.parent_symbol_id ? ProjectRevision.#convertBigIntToHex(row.parent_symbol_id) : null,
                flags: Number(row.flags)
            });
        }
        return result;
    }

    listSymbolReferencesByFile(symbolId) {
        symbolId = ProjectRevision.#convertSymbolIdFromHex(symbolId);
        let query = `SELECT file_id, line, col, parent_symbol_id, flags FROM symbolReference WHERE symbol_id = ?
          ORDER BY file_id, line, col ASC`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        let rows = stmt.all(symbolId);

        let result = [];
        let curfile = null;
        let curfilerefs = [];
        for (const row of rows) {
            if (Number(row.file_id) != curfile) {
                if (curfilerefs.length > 0) {
                    result.push({
                        file: this.files[curfile],
                        references: curfilerefs
                    });
                    curfilerefs = [];
                }

                curfile = Number(row.file_id);
            }

            curfilerefs.push({
                line: Number(row.line),
                col: Number(row.col),
                flags: Number(row.flags)
            });
        }

        if (curfilerefs.length > 0) {
            result.push({
                file: this.files[curfile],
                references: curfilerefs
            });
        }

        return result;
    }

    listSymbolReferencesInFile(fileid) {
        let query = `WITH referencedSymbols AS (SELECT DISTINCT symbol_id from symbolReference where file_id = ${fileid}) 
            SELECT id, kind, parent, name, displayname, flags, parameterIndex, type, value FROM symbol 
            WHERE id IN referencedSymbols`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        let referencedSymbols = this.#readSymbolsAsDict(stmt.all());
  
        query = `SELECT symbol_id, line, col, parent_symbol_id, flags FROM symbolReference WHERE file_id = ${fileid}`;
        stmt = this.db.prepare(query);
        stmt.safeIntegers();

        let references = [];
        for (let row of stmt.all()) {
            let r = {
                line: Number(row.line),
                col: Number(row.col),
                symbolId: ProjectRevision.#convertBigIntToHex(row.symbol_id),
                flags: Number(row.flags),
            };
            if (row.parent_symbol_id) {
                r.parentSymbolId = ProjectRevision.#convertBigIntToHex(row.parent_symbol_id);
            }
            references.push(r);
        }

        return {
            references: references,
            symbols: referencedSymbols
        };
    }

    listDefinitionsOfSymbolsReferencedInFile(fileid) {
        let query = `WITH referencedSymbols AS (SELECT DISTINCT symbol_id from symbolReference where file_id = ${fileid}) 
            SELECT symbol_id, file_id, line, col FROM symbolDefinition 
            WHERE symbol_id IN referencedSymbols`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        let rows = stmt.all();
  
        let definitions = {};
        for (let row of rows) {
            let symbolid = ProjectRevision.#convertBigIntToHex(row.symbol_id);
            let def =  {
                fileid: Number(row.file_id),
                line: Number(row.line),
                col: Number(row.col)
            };

            if (!definitions[symbolid]) {
                definitions[symbolid] = def;
            } else if(Array.isArray(definitions[symbolid])) {
                definitions[symbolid].push(def);
            } else {
                definitions[symbolid] = [definitions[symbolid], def];
            }
        }

        return definitions;
    }

    #readDiagnosticLevels() {
        let rows = this.db.prepare('SELECT value, name FROM diagnosticLevel').all();
        let dlvls = {};
        for (let r of rows) {
            dlvls[Number(r.value)] = r.name;
        }
        return dlvls;
    }

    #readAccessSpecifiers() {
        let rows = this.db.prepare('SELECT value, name FROM accessSpecifier ORDER BY value ASC').all();
        let kinds = [];
        for (let r of rows) {
            assert(Number(r.value) == kinds.length);
            kinds.push(r.name);
        }
        return kinds;
    }

    #readSymbolKinds() {
        let rows = this.db.prepare('SELECT id, name FROM symbolKind ORDER BY id ASC').all();
        let kinds = [];
        for (let r of rows) {
            assert(Number(r.id) == kinds.length);
            kinds.push(r.name);
        }
        return kinds;
    }

    #readSymbolFlags() {
        let rows = this.db.prepare('SELECT name, value FROM symbolFlag').all();
        let result = {};
        for (let r of rows) {
            result[r.name] = Number(r.value);
        }
        return result;
    }

    #readSymbolReferenceFlags() {
        let rows = this.db.prepare('SELECT name, value FROM symbolReferenceFlag').all();
        let result = {};
        for (let r of rows) {
            result[r.name] = Number(r.value);
        }
        return result;
    }
};

class Project
{
    name;
    revisions;

    constructor(n) {
        this.name = n;
        this.revisions = [];
    }

    static destroy(instance) {
        for (let rev of instance.revisions) {
            ProjectRevision.destroy(rev);
        }

        instance.revisions = [];
    }

    getRevision(name) {
        let i = this.revisions.findIndex(e => e.name == name);
        if (i != -1) {
            return this.revisions[i];
        } else {
            return null;
        }
    }

    addRevision(rev) {
        this.revisions.push(rev);
        this.revisions.sort((a, b) => ProjectVersion.comp(a.projectVersion, b.projectVersion)).reverse();
    }

    removeRevision(rev) {
        if (rev instanceof ProjectRevision) {
            let i = this.revisions.indexOf(rev);
            this.revisions.splice(i, 1);
            ProjectRevision.destroy(rev);
            return true;
        } else if (rev instanceof ProjectVersion) {
            let i = this.revisions.findIndex(e => ProjectVersion.eq(rev, e.projectVersion));
            if (i != -1) {
                rev = this.revisions[i];
                this.revisions.splice(i, 1);
                ProjectRevision.destroy(rev);
                return true;
            }
        } else if (typeof rev == 'string') {
            let i = this.revisions.findIndex(e => e.projectVersion.toString() == rev);
            if (i != -1) {
                rev = this.revisions[i];
                this.revisions.splice(i, 1);
                ProjectRevision.destroy(rev);
                return true;
            }
        }

        return false;
    }
};

module.exports = { ProjectVersion, ProjectRevision, Project };
