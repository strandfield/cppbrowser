

const Database = require('better-sqlite3');

const Path = require('node:path');
var fs = require('fs');


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
        this.name = this.properties.project?.name ?? Path.parse(dbPath).name;

        this.homeDir = this.properties.project?.home;
        if (!this.homeDir) {
            this.homeDir = this.#getHomeDirFromFiles();
        }

        // si le projet n'a pas de version: default

        this.files = {};
        this.maxfileid = 0;

        let rows = this.db.prepare('SELECT id, path FROM file').all();
        for (let r of rows) {
            this.files[r.id] = r.path.replaceAll('\\', '/');
            this.maxfileid = Math.max(r.id, this.maxfileid);
        }

        this.diagnosticLevels = this.#readDiagnosticLevels();
        this.symbolKinds = this.#readSymbolKinds();
        this.symbolFlags = this.#readSymbolFlags();
        this.symbolReferenceFlags = this.#readSymbolReferenceFlags();
    }

    static open(dbPath) {
        return new ProjectRevision(dbPath);
    }

    static destroy(project) {
        project.db.close();
        fs.rm(project.path, function(err) {
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

        let dirname = dirpath.substring(dirpath, dirpath.indexOf('/'));
        if (dirname == "") {
            dirname = "/";
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

    #readSymbolKinds() {
        let rows = this.db.prepare('SELECT id, name FROM symbolKind').all();
        let kinds = {};
        for (let r of rows) {
            kinds[Number(r.id)] = r.name;
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

module.exports = ProjectRevision;
