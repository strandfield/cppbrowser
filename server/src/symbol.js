

const { symbolKinds } = require('@cppbrowser/snapshot-tools');

function getSnapshotSymbolInfo(inputSymbol, revision) {
    let symbol = {

    };
    Object.assign(symbol, inputSymbol);

    symbol.kind = symbolKinds[symbol.kind];

    if (symbol.kind == 'class' || symbol.kind == 'struct') {
      symbol.baseClasses = revision.getBaseClasses(symbol.id);
      symbol.derivedClasses = revision.getDerivedClasses(symbol.id);
    }

    let children = revision.getChildSymbols(symbol.id);

    let namespacekind = symbolKinds.values['namespace'];
    symbol.namespaces = children.filter(e => e.kind == namespacekind);
    symbol.namespaces.sort((a,b) => a.name.localeCompare(b.name));

    let classkind = symbolKinds.values['class'];
    let structkind = symbolKinds.values['struct'];
    let unionkind = symbolKinds.values['union'];
    symbol.records = children.filter(e => e.kind == classkind || e.kind == structkind || e.kind == unionkind);
    symbol.records.sort((a,b) => a.name.localeCompare(b.name));

    let functionkind = symbolKinds.values['function'];
    symbol.functions = children.filter(e => e.kind == functionkind);
    symbol.functions.sort((a,b) => a.name.localeCompare(b.name));

    let ctorkind = symbolKinds.values['constructor']; 
    symbol.constructors = children.filter(e => e.kind == ctorkind);

    let dtorkind = symbolKinds.values['destructor']; 
    symbol.destructors = children.filter(e => e.kind == dtorkind);

    let fieldkind = symbolKinds.values['field']; 
    symbol.fields = children.filter(e => e.kind == fieldkind);
    symbol.fields.sort((a,b) => a.name.localeCompare(b.name));

    let methodkind = symbolKinds.values['instance-method']; 
    symbol.methods = children.filter(e => e.kind == methodkind);
    symbol.methods.sort((a,b) => a.name.localeCompare(b.name));

    symbol.children = children;

    if (symbol.parentId) {
      symbol.parent = revision.getSymbolById(symbol.parentId);
      if (symbol.parent) {
        symbol.parent.kind = symbolKinds.names[symbol.parent.kind];
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
    getSnapshotSymbolInfo
};
