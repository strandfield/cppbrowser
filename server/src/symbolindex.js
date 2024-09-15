
const { symbolKinds } = require("@cppbrowser/snapshot-tools");

const { ProjectRevision, Project } = require('./project.js');
const ProjectManager = require("./projectmanager.js");


class SymbolIndex
{
    #projectRevisions; // array
    #symbolsMap; // Map
    #symbolsChildren; // array
    #projectManager = null;

    constructor() {
        this.#projectRevisions = [];
        this.#symbolsMap = new Map();
        this.#symbolsChildren = [];
    }

    clear() {
        this.#projectRevisions = [];
        this.#symbolsMap.clear();
        this.#symbolsChildren = [];
        this.#projectManager = null;
    }

    #insertSymbols(symbols) {
        for (const sym of symbols) {
            if (this.#symbolsMap.has(sym.id)) {
                continue;
            } else {
                this.#symbolsMap.set(sym.id, sym);
            }
        }
    }

    #collectSymbolsFromProjectRevision(rev) {
        if (!rev) {
            return;
        }

        this.#projectRevisions.push(rev);

        let symbols = rev.selectNonLocalDefinedSymbols();
        // TODO: attach project rev to symbol
        this.#insertSymbols(symbols);

        symbols = rev.selectNamespaces();
        // TODO: attach project rev to symbol
        this.#insertSymbols(symbols);
    }

    #collectSymbolsFromProject(project) {
        if (project instanceof ProjectRevision) {
            this.#collectSymbolsFromProjectRevision(project);
            return;
        }

        for (const rev of project.revisions) {
            this.#collectSymbolsFromProjectRevision(rev);
        }
    }

    #collectSymbolsChildren() {
        let allsymbols = Array.from(this.#symbolsMap.values());
        allsymbols.sort((a, b) => {
            if (!a.parentId) {
                if (!b.parentId) {
                    return 0;
                } else {
                    return -1;
                }
            } else if (!b.parentId) {
                return 1;
            } else {
                return a.parentId > b.parentId ? 1 : -1;
            }
        });

        this.#symbolsChildren = allsymbols;

        let i = 0;
        while (i < allsymbols.length) {
            let curparent = allsymbols[i].parentId;
            let j = i + 1;
            while (j < allsymbols.length && allsymbols[j].parentId == curparent) j++;
            let n = j - i;
            if (curparent) {
                let parent_symbol = this.#symbolsMap.get(curparent);
                if (parent_symbol) {
                    parent_symbol.firstChildIndex = i;
                    parent_symbol.childCount = n;
                }
            }
            i = j;
        }
    }

    build(projectContainer) {
        if (Array.isArray(projectContainer)) {
            for (const pro of projectContainer) {
                this.#collectSymbolsFromProject(pro);
            }
        } else if (projectContainer instanceof ProjectManager) {
            this.#projectManager = projectContainer;
            for (const pro of projectContainer.getProjects()) {
                this.#collectSymbolsFromProject(pro);
            }
        } else if (projectContainer instanceof Project) {
            this.#collectSymbolsFromProject(projectContainer);
        } else if (projectContainer instanceof ProjectRevision) {
            this.#collectSymbolsFromProjectRevision(projectContainer);
        } else {
            console.log("bad project container");
            return;
        }
        
        this.#collectSymbolsChildren();
    }

    rebuild() {
        const project_manager = this.#projectManager;
        this.clear();
        this.build(project_manager);
    }

    getSource() {
        let snapshots = [...this.#projectRevisions];
        snapshots.sort((a,b) => {
            return a.projectName.localeCompare(b.projectName);
        });

        let result = [];
        let push_result = function(projectName, versions) {
            result.push({
                project: projectName,
                versions: versions
            });
        };

        if (snapshots.length > 0) {
            let project_name = snapshots[0].projectName;
            let versions = [];
            for (const snapshot of snapshots) {
                if (project_name != snapshot.projectName) {
                    push_result(project_name, versions);
                    project_name = snapshot.projectName;
                    versions = [];
                }

                versions.push(snapshot.name);
            }

            push_result(project_name, versions);
        }

        return result;
    }

    getSnapshot(projectName, projectRevision) {
        return this.#projectRevisions.find(e => {
            return e.projectName == projectName && e.name == projectRevision;
        });
    }

    getSymbolById(symbolID) {
        return this.#symbolsMap.get(symbolID);
    }

    getTopLevelSymbols() {
        let allsymbols = this.#symbolsChildren;
        let i = 0;
        while (i < allsymbols.length && !allsymbols[i].parentId) i++;
        return allsymbols.slice(0, i);
    }

    getSymbolChildren(symbolOrId) {
        if (!symbolOrId) {
            return [];
        }

        if (typeof symbolOrId == 'string') {
            return this.getSymbolChildren(this.getSymbolById(symbolOrId));
        } else {
            let symbol = symbolOrId;
            if (symbol.firstChildIndex) {
                return this.#symbolsChildren.slice(symbol.firstChildIndex, symbol.firstChildIndex + symbol.childCount);
            } else {
                return [];
            }
        }
    }

    listSymbolReferences(symbolId) {
        let refsByProjectRev = [];

        for (const rev of this.#projectRevisions) {
            let refs = rev.listSymbolReferencesByFile(symbolId);

            if (refs && refs.length > 0) {
                let entry = {
                    projectRevision: rev,
                    references: refs
                }
                refsByProjectRev.push(entry);
            }
        }

        refsByProjectRev.sort((a, b) => a.projectRevision.projectName.localeCompare(b.projectRevision.projectName));

        return refsByProjectRev;
    }

    forEachSymbol(f) {
        this.#symbolsMap.forEach(f);
    }

    #getSymbolInfoImpl(symbol) {
        let info = {
            id: symbol.id,
            kind: symbolKinds.names[symbol.kind],
            name: symbol.name
        };

        let get_info_children = function() {
            if (!info.children) {
                info.children = {};
            }
            return info.children;
        }

        /// TODO: do this for every rev in which the symbol is defined
        // if (info.kind == 'class' || info.kind == 'struct') {
        //   info.baseClasses = revision.getBaseClasses(symbol.id);
        //   info.derivedClasses = revision.getDerivedClasses(symbol.id);
        // }
    
        let children = this.getSymbolChildren(symbol.id);

        if (info.kind == 'namespace') {
            let k = symbolKinds.values['namespace'];
            let nss = children.filter(e => e.kind == k);
            nss.sort((a,b) => a.name.localeCompare(b.name));

            get_info_children().namespaces = nss.map(e => {
                return {
                    name: e.name,
                    id: e.id
                };
            });
        }

        if (info.kind == 'namespace' || info.kind == 'class' || info.kind == 'struct') {
            let k1 = symbolKinds.values['class'];
            let k2 = symbolKinds.values['struct'];
            let k3 = symbolKinds.values['union'];
            let records = children.filter(e => e.kind == k1 || e.kind == k2 || e.kind == k3);
            records.sort((a,b) => a.name.localeCompare(b.name));

            get_info_children().records = records.map(e => {
                return {
                    name: e.name,
                    kind: symbolKinds.names[e.kind],
                    id: e.id
                };
            });
        }

        if (info.kind == 'class' || info.kind == 'struct') {
            let k = symbolKinds.values['constructor'];
            let ctors = children.filter(e => e.kind == k);

            get_info_children().constructors = ctors.map(e => {
                return {
                    name: e.name,
                    id: e.id
                };
            });
        }

        if (info.kind == 'class' || info.kind == 'struct') {
            let k = symbolKinds.values['destructor'];
            let dtors = children.filter(e => e.kind == k);

            get_info_children().destructors = dtors.map(e => {
                return {
                    name: e.name,
                    id: e.id
                };
            });
        }
    
        if (info.kind == 'class' || info.kind == 'struct') {
            let k = symbolKinds.values['instance-method'];
            let methods = children.filter(e => e.kind == k);

            get_info_children().methods = methods.map(e => {
                return {
                    name: e.name,
                    id: e.id
                };
            });
        }

        if (info.kind == 'namespace') {
            let k = symbolKinds.values['function'];
            let functions = children.filter(e => e.kind == k);
            functions.sort((a,b) => a.name.localeCompare(b.name));

            get_info_children().functions = functions.map(e => {
                return {
                    name: e.name,
                    id: e.id
                };
            });
        }

        if (info.kind == 'class' || info.kind == 'struct') {
            let k = symbolKinds.values['field'];
            let fields = children.filter(e => e.kind == k);
            fields.sort((a,b) => a.name.localeCompare(b.name));

            get_info_children().fields = fields.map(e => {
                return {
                    name: e.name,
                    id: e.id,
                };
            });
        }
        
        if (symbol.parentId) {
          let parent = this.getSymbolById(symbol.parentId);
          if (parent) {
            info.parent = {
                name: parent.name,
                id: parent.id,
                kind: symbolKinds.names[parent.kind]
            };
          }
        }
    
        // TODO: list the definitions
    
        return info;
    }

    getSymbolInfo(symbolOrId) {
        if (!symbolOrId) {
            return null;
        }

        if (typeof symbolOrId == 'string') {
            return this.#getSymbolInfoImpl(this.getSymbolById(symbolOrId));
        } else if (typeof symbol.id == 'string') {
            return this.#getSymbolInfoImpl(symbol);
        } else {
            return null;
        }
    }

    getNamespaces() {
        // TODO: this can probably be optimized as namespace can only be child of other namespaces
        // leading back to the root node
        return this.getSymbolsByKind('namespace');
    }

    getSymbolsByKind(kind) {
        let results = [];

        if (typeof kind == 'string') {
            kind = symbolKinds.values[kind];
        }

        if (kind == null) {
            return results;
        }

        this.forEachSymbol(s => {
            if (s.kind == kind) {
                results.push(s);
            }
        });

        return results;
    }
};

module.exports = SymbolIndex;
