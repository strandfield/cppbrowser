
const { ProjectRevision, Project } = require('./project.js');
const ProjectManager = require("./projectmanager.js");

class SymbolIndex
{
    #projectRevisions; // array
    #symbolsMap; // Map
    #symbolsChildren; // array

    constructor() {
        this.#projectRevisions = [];
        this.#symbolsMap = new Map();
        this.#symbolsChildren = [];
    }

    clear() {
        this.#projectRevisions = [];
        this.#symbolsMap.clear();
        this.#symbolsChildren = [];
    }

    #collectSymbolsFromProjectRevision(rev) {
        if (!rev) {
            return;
        }

        this.#projectRevisions.push(rev);

        let symbols = rev.selectNonLocalDefinedSymbols();
        for (const sym of symbols) {
            if (this.#symbolsMap.has(sym.id)) {
                continue;
            } else {
                this.#symbolsMap.set(sym.id, sym);
            }
        }
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
};

module.exports = SymbolIndex;
