

const { symbolKinds, getSymbolKindByName, getSymbolKindValue, selectNamespaceQuery } = require('@cppbrowser/snapshot-tools');

const { checkTableExists, checkColumnExists } = require('./database');

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

// open a project database and updates its schema if it is not up to date.
// returns a Database object.
function openProjectDatabase(filePath) {
    let options = {
        readonly: true,
        fileMustExist: true
      };   

    let db = new Database(filePath, options);

    const version = parseInt(readPropertyFromDatabase(db, "database.schema.version", "0"));

    // note: in the future, we should rely on "version" exclusively to decide if the database needs
    // to be updated
    const has_refargs = checkTableExists(db, "argumentPassedByReference");
    const has_file_sha1 = checkColumnExists(db, "file", "sha1");

    if (has_refargs && has_file_sha1) {
        return db;
    }

    db.close();
    options.readonly = false;
    db = new Database(filePath, options);

    if (!has_refargs) {
        createArgumentPassedByReferenceTable(db);
    }

    if (!has_file_sha1) {
        createSha1Column(db);
    }

    db.close();
    options.readonly = true;
    return new Database(filePath, options);
}

// TODO(v0.4): remove me
function createArgumentPassedByReferenceTable(databaseObject) {
    let stmt = databaseObject.prepare(`CREATE TABLE "argumentPassedByReference" (
       "file_id"               INTEGER NOT NULL,
       "line"                  INTEGER NOT NULL,
       "column"                INTEGER NOT NULL,
       FOREIGN KEY("file_id")  REFERENCES "file"("id")
    )`);
    stmt.run();
}

// TODO(v0.4): remove me
function createSha1Column(databaseObject) {
    // note: removing a column would be done with ALTER TABLE table DROP COLUMN column
    let stmt = databaseObject.prepare(`
        ALTER TABLE file
        ADD sha1 TEXT`);
    stmt.run();

    const crypto = require('crypto')

    stmt = databaseObject.prepare(`SELECT id, path, content FROM file`);
    let update_stmt = databaseObject.prepare(`UPDATE file SET sha1 = ? WHERE id = ?`);
    for (const row of stmt.all()) {
        if (typeof row.content == 'string' && row.content.length > 0) {
            let shasum = crypto.createHash('sha1');
            shasum.update(row.content);
            const sha1 = shasum.digest('hex');
            update_stmt.run(sha1, row.id);
        }
    }
}

function readPropertyFromDatabase(databaseObject, propertyName, defaultValue = undefined) {
    let row = databaseObject.prepare("SELECT value FROM info WHERE key = ?").get(propertyName);
    return row ? row.value : defaultValue;
}

class ProjectRevision
{
    constructor(dbPath) {
        this.path = dbPath;
        this.db = openProjectDatabase(dbPath);

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

    getProjectName() {
        return this.projectName;
    }

    getVersionObject() {
        return this.projectVersion;
    }

    // properties are available through the "properties" field so this function 
    // isn't that useful.
    readProperty(name, defaultValue = undefined) {
        return readPropertyFromDatabase(this.db, name, defaultValue);
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

    getFileById(fileId) {
        return this.files[fileId];
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

    getPathRelativeToHome(filePath) {
        if (filePath.startsWith(this.homeDir)) {
            return filePath.substring(this.homeDir.length + 1);
        } else {
            return filePath;
        }
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

    // TODO: fix this bad api
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

        if (row.flags != undefined) {
            symbol.flags = Number(row.flags);
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
        let stmt = this.db.prepare("SELECT id, kind, parent, name, flags FROM symbol WHERE id = ?");
        stmt.safeIntegers();
        let row = stmt.get(idint);
        return this.#readSymbol(row);
    }

    getSymbolByName(name) {
        let stmt = this.db.prepare("SELECT id, kind, parent, name, flags FROM symbol WHERE name = ?");
        stmt.safeIntegers();
        let row = stmt.get(name);
        return this.#readSymbol(row);
    }

    getChildSymbols(parentid) {
        parentid = ProjectRevision.#convertSymbolIdFromHex(parentid);
        let q = "SELECT id, kind, name, flags FROM symbol WHERE parent = ?";
        let stmt = this.db.prepare(q);
        stmt.safeIntegers();
        let rows = stmt.all(parentid);
        return this.#readSymbols(rows);
    }

    // TODO: add getMemberFunctions()
    // TODO: add getDataMembers()
    // getFunctions(), getVariables(), getEnumConstants()

    /**
     * @returns all non-local symbols from the project
     * @note symbols from outside the project that are referenced in the project are excluded from this list
     * 
     * @sa getProjectSymbolsEx()
     */
    getProjectSymbols() {
        let query = `SELECT id, kind, parent, name, flags FROM symbol WHERE (symbol.isLocal = 0)`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        let rows = stmt.all();
        return this.#readSymbols(rows);
    }

    /**
     * @returns non-local top-level symbols from the project
     * @note top-level symbols from outside the project that are referenced in the project are excluded from this list
     */
    getProjectTopLevelSymbols() {
        let stmt = this.db.prepare("SELECT id, kind, name, flags FROM symbol WHERE parent IS NULL AND (symbol.isLocal = 0) AND symbol.isFromProject");
        stmt.safeIntegers();
        let rows = stmt.all();
        return this.#readSymbols(rows);
    }

    /**
     * 
     * @param {*} opts filtering options
     * @returns a filtered list of project symbols
     * 
     * Possible fields for @a opts are:
     * - kind: a single symbol kind;
     * - kinds: an array of symbol kinds
     * - topLevel: for restricting the query to top-level symbols
     * - parentId: for specifying a parent symbol id
     * 
     * If a single kind is specified, the associated field won't be written in the output.
     * Likewise, if a parentId is specified, the associated field won't be written in the output. 
     * 
     * @sa getProjectSymbols()
     */
    getProjectSymbolsEx(opts) {
        let kinds = opts.kinds ?? [];
        if (opts.kind) {
            kinds.push(opts.kind);
        }

        kinds = kinds.map(e => `kind = ${getSymbolKindValue(e)}`);

        if (kinds.length == 0) {
            return this.getProjectSymbols();
        }

        let kClause = kinds.length > 0 ? `(${kinds.join(" OR ")})` : "TRUE";

        let parentId = opts.parentId ? ProjectRevision.#convertSymbolIdFromHex(opts.parentId) : null;
        let pClause = "TRUE";
        if (parentId) {
            pClause = "parent = ?";
        } else if (opts.topLevel) {
            pClause = "parent IS NULL";
        }

        let fields = ["id", "name", "flags"];

        if (!opts.kind) {
            fields.push("kind");
        }

        if (pClause == "TRUE") {
            fields.push("parent");
        }

        fields = fields.join(", ");

        let query = `SELECT ${fields} FROM symbol WHERE (symbol.isLocal = 0) AND ${kClause} AND ${pClause}`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        let rows = parentId ? stmt.all(parentId) : stmt.all();
        return this.#readSymbols(rows);
    }

    #postProcessSymbolRow(row) {
        if (!row) {
            return;
        }

        row.id = ProjectRevision.#convertBigIntToHex(row.id);
        
        if (row.kind) {
            Number(row.kind);
        }

        if (row.parent) {
            row.parentId = ProjectRevision.#convertBigIntToHex(row.parent);
            row.parent = undefined;
        }

        if (row.flags != undefined) {
            row.flags = Number(row.flags);
        }
    }

    getChildSymbolsEx(parentId, opts) {
        parentId = ProjectRevision.#convertSymbolIdFromHex(parentId);

        let table = opts.table ?? "symbol";

        let kinds = opts.kinds ?? [];
        if (opts.kind) {
            kinds.push(opts.kind);
        }

        kinds = kinds.map(e => `kind = ${getSymbolKindValue(e)}`);
        let kClause = kinds.length > 0 ? `(${kinds.join(" OR ")})` : "TRUE";

        let pClause = "parent = ?";

        let eClause = opts.extraClause ?? "TRUE";

        let fields = ["id", "name", "flags"];

        if (opts.fields) {
            fields = fields.concat(opts.fields);
        }

        if (!opts.kind) {
            fields.push("kind");
        }

        if (pClause == "TRUE") {
            fields.push("parent");
        }

        fields = fields.join(", ");

        let query = `SELECT ${fields} FROM ${table} WHERE ${kClause} AND ${pClause} AND ${eClause}`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        let rows = stmt.all(parentId);
        rows.forEach(r => this.#postProcessSymbolRow(r));
        return rows;
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

    // listSymbolReferences(symbolId) {
    //     symbolId = ProjectRevision.#convertSymbolIdFromHex(symbolId);
    //     let query = `SELECT file_id, line, col, parent_symbol_id, flags FROM symbolReference WHERE symbol_id = ?`;
    //     let stmt = this.db.prepare(query);
    //     stmt.safeIntegers();
    //     let rows = stmt.all(symbolId);

    //     let result = [];
    //     for (const row of rows) {
    //         result.push({
    //             fileId: Number(row.file_id),
    //             line: Number(row.line),
    //             col: Number(row.col),
    //             refbySymbolId: row.parent_symbol_id ? ProjectRevision.#convertBigIntToHex(row.parent_symbol_id) : null,
    //             flags: Number(row.flags)
    //         });
    //     }
    //     return result;
    // }

    listSymbolReferencesByFile(symbolId, flags = []) {
        symbolId = ProjectRevision.#convertSymbolIdFromHex(symbolId);
        const flagsClause = flags.length == 0 ? "TRUE" : flags.map(e => e + " = 1").join("AND");
        let query = `
          SELECT file_id, line, col, parent_symbol_id, flags 
          FROM symbolReference 
          WHERE symbol_id = ? AND (${flagsClause})
          ORDER BY file_id, line, col ASC
        `;
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
                        filePath: this.files[curfile].substring(this.homeDir.length + 1),
                        references: curfilerefs
                    });
                    curfilerefs = [];
                }

                curfile = Number(row.file_id);
            }

            curfilerefs.push({
                line: Number(row.line),
                col: Number(row.col),
                flags: Number(row.flags),
                refbySymbolId: row.parent_symbol_id ? ProjectRevision.#convertBigIntToHex(row.parent_symbol_id) : undefined,
            });
        }

        if (curfilerefs.length > 0) {
            result.push({
                filePath: this.files[curfile].substring(this.homeDir.length + 1),
                references: curfilerefs
            });
        }

        return result;
    }

    listSymbolsReferencedInFile(fileId) {
        let query = `WITH referencedSymbols AS (SELECT DISTINCT symbol_id from symbolReference where file_id = ${fileId}) 
          SELECT id, kind, parent, name, flags FROM symbol 
          WHERE id IN referencedSymbols`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        return this.#readSymbolsAsDict(stmt.all());
    }

    listSymbolReferencesInFile(fileId) {  
        const query = `SELECT symbol_id, line, col, flags FROM symbolReference WHERE file_id = ${fileId}`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();

        let references = [];
        for (let row of stmt.all()) {
            let r = {
                line: Number(row.line),
                col: Number(row.col),
                symbolId: ProjectRevision.#convertBigIntToHex(row.symbol_id),
                flags: Number(row.flags),
            };
            references.push(r);
        }

        return references;
    }

    listSymbolReferencesInFileLegacy(fileid) {
        const referencedSymbols = this.listSymbolsReferencedInFile(fileid);
        const references = this.listSymbolReferencesInFile(fileid);
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

    listSymbolDeclarations(symbolId) {
        symbolId = ProjectRevision.#convertSymbolIdFromHex(symbolId);
        let query = `SELECT file_id, 
                            startPositionLine as startLine, startPositionColumn as startCol,
                            endPositionLine as endLine, endPositionColumn as endCol,
                            isDefinition
                            FROM symbolDeclaration WHERE symbol_id = ?
          ORDER BY file_id, startLine ASC`;
        let stmt = this.db.prepare(query);
        stmt.safeIntegers();
        let rows = stmt.all(symbolId);

        let result = [];
        for (const row of rows) {
            result.push({
                fileId: Number(row.file_id),
                sourceRange: {
                    begin: {
                        line: Number(row.startLine),
                        col: Number(row.startCol),
                    },
                    end: {
                        line: Number(row.endLine),
                        col: Number(row.endCol)
                    }
                },
                isDef: Number(row.isDefinition) == 1,
            });
        }
        return result;
    }

    getArgumentsPassedByReference(fileId) {
        let query = `SELECT line, column FROM argumentPassedByReference WHERE file_id = ?`;
        let stmt = this.db.prepare(query);
        return stmt.all(fileId);
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
