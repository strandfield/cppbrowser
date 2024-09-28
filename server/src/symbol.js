

const { symbolKinds } = require('@cppbrowser/snapshot-tools');

function getSnapshotSymbolInfoLegacy(inputSymbol, revision) {
    let symbol = {

    };
    Object.assign(symbol, inputSymbol);

    symbol.kind = symbolKinds.names[symbol.kind];

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

    let methodkind = symbolKinds.values['method']; 
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

function getSnapshotSymbolInfo(inputSymbol, revision) {
  let symbol = {

  };
  Object.assign(symbol, inputSymbol);

  symbol.kind = symbolKinds.names[symbol.kind];

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

  {
    symbol.enums = revision.getChildSymbolsEx(symbol.id, {
      table: 'enumRecord',
      kind: 'enum'
    });
  }

  if (symbol.kind == 'enum')
  {
    symbol.enumConstants = revision.getChildSymbolsEx(symbol.id, {
      table: 'enumConstantRecord',
      kind: 'enum-constant'
    });
  }

  if (symbol.kind == 'class' || symbol.kind == 'struct')
  {
    symbol.fields = revision.getChildSymbolsEx(symbol.id, {
      table: 'variableRecord',
      kind: 'field',
      fields: ['type']
    });

    symbol.constructors = revision.getChildSymbolsEx(symbol.id,{
      kind: 'constructor'
    });

    symbol.destructors = revision.getChildSymbolsEx(symbol.id,{
      kind: 'destructor'
    });

    symbol.methods = revision.getChildSymbolsEx(symbol.id,{
      table: 'functionRecord',
      kind: 'method',
      fields: ['returnType']
    });

    symbol.staticMethods = revision.getChildSymbolsEx(symbol.id,{
      table: 'functionRecord',
      kind: 'static-method',
      fields: ['returnType']
    });
  }

  if (symbol.kind == 'namespace' || symbol.kind == 'inline-namespace') {
    symbol.functions = revision.getChildSymbolsEx(symbol.id,{
      table: 'functionRecord',
      kind: 'function',
      fields: ['returnType']
    });
  }

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
  getSnapshotSymbolInfoLegacy,
  getSnapshotSymbolInfo
};
