

const { ProjectRevision } = require('./project.js');


const symbolKinds = {
  names: [
    "<unknown>",
     "module",
     "namespace",
     "namespace-alias",
     "macro",
     "enum",
     "struct",
     "class",
     "union",
     "lambda",
     "type-alias",
     "function",
     "variable",
     "field",
     "enum-constant",
     "instance-method",
     "class-method",
     "static-method",
     "static-property",
     "constructor",
     "destructor",
     "conversion-function",
     "parameter",
     "using",
     "template-type-parameter",
     "template-template-parameter",
     "non-type-template-parameter",
     "concept"
    ],
  values: {
    "module": 1,
    "namespace": 2,
    "namespace-alias": 3,
    "macro": 4,
    "enum": 5,
    "struct": 6,
    "class": 7,
    "union": 8,
    "lambda": 9,
    "type-alias": 10,
    "function": 11,
    "variable": 12,
    "field": 13,
    "enum-constant": 14,
    "instance-method": 15,
    "class-method": 16,
    "static-method": 17,
    "static-property": 18,
    "constructor": 19,
    "destructor": 20,
    "conversion-function": 21,
    "parameter": 22,
    "using": 23,
    "template-type-parameter": 24,
    "template-template-parameter": 25,
    "non-type-template-parameter": 26,
    "concept": 27,
  }
};

function getSnapshotSymbolInfo(inputSymbol, revision) {
    let symbol = {

    };
    Object.assign(symbol, inputSymbol);

    symbol.kind = revision.symbolKinds[symbol.kind];

    if (symbol.kind == 'class' || symbol.kind == 'struct') {
      symbol.baseClasses = revision.getBaseClasses(symbol.id);
      symbol.derivedClasses = revision.getDerivedClasses(symbol.id);
    }

    let children = revision.getChildSymbols(symbol.id);

    let namespacekind = revision.getSymbolKindValue('namespace');
    symbol.namespaces = children.filter(e => e.kind == namespacekind);
    symbol.namespaces.sort((a,b) => a.name.localeCompare(b.name));

    let classkind = revision.getSymbolKindValue('class');
    let structkind = revision.getSymbolKindValue('struct');
    let unionkind = revision.getSymbolKindValue('union');
    symbol.records = children.filter(e => e.kind == classkind || e.kind == structkind || e.kind == unionkind);
    symbol.records.sort((a,b) => a.name.localeCompare(b.name));

    let functionkind = revision.getSymbolKindValue('function');
    symbol.functions = children.filter(e => e.kind == functionkind);
    symbol.functions.sort((a,b) => a.name.localeCompare(b.name));

    let ctorkind = revision.getSymbolKindValue('constructor'); 
    symbol.constructors = children.filter(e => e.kind == ctorkind);

    let dtorkind = revision.getSymbolKindValue('destructor'); 
    symbol.destructors = children.filter(e => e.kind == dtorkind);

    let fieldkind = revision.getSymbolKindValue('field'); 
    symbol.fields = children.filter(e => e.kind == fieldkind);
    symbol.fields.sort((a,b) => a.name.localeCompare(b.name));

    let methodkind = revision.getSymbolKindValue('instance-method'); 
    symbol.methods = children.filter(e => e.kind == methodkind);
    symbol.methods.sort((a,b) => a.name.localeCompare(b.name));

    symbol.children = children;

    if (symbol.parentId) {
      symbol.parent = revision.getSymbolById(symbol.parentId);
      if (symbol.parent) {
        symbol.parent.kind = revision.symbolKinds[symbol.parent.kind];
      }
    }

    symbol.references = revision.listSymbolReferencesByFile(symbol.id);

    let defs = [];
    for (const refsInFile of symbol.references) {
      for (const symref of refsInFile.references) {
        if (symref.flags & 2) {
          let e = {
            completeFilePath: refsInFile.file, // TODO: remove me ?
            filePath: refsInFile.file.substring(revision.homeDir.length + 1)
          };
          Object.assign(e, symref);
          defs.push(e);
        }
      }
    }

    symbol.definitions = defs;

    return symbol;
}

module.exports = {
    symbolKinds,
    getSnapshotSymbolInfo
};
