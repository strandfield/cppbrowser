

const { symbolKinds, symbolReference_isDef } = require('@cppbrowser/snapshot-tools');

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

  if (symbol.kind != 'namespace') { // too many references for namespaces, and not that useful
    let references = revision.listSymbolReferencesByFile(symbol.id, ["isDefinition"]);

    let defs = [];
    for (const refsInFile of references) {
      for (const symref of refsInFile.references) {
        console.assert(symbolReference_isDef(symref));
        let e = {
          filePath: refsInFile.file.substring(revision.homeDir.length + 1)
        };
        Object.assign(e, symref);
        delete e.flags;
        defs.push(e);
      }
    }

    symbol.definitions = defs;

    // TODO: do not list declarations here?
    // ça reste quand même moins coûteux que de lister les définitions via listSymbolReferencesByFile()
    // a priori.
    // peut-être devrait-on lister toutes les définitions (quel que soit le symbolkind)
    // comme déclaration.
    // et dans ce cas on ne liste que les vraies références dans la table symbolReference ?
    // il faudrait voir si on peut avoir une decl/def avec le flag dynamic.
    // le flag dynmaic pourrait être un flag de symbolDeclaration.
    // edit: oui on peut avoir le flag dynamic sur une ref de type dec/def. mais on sait 
    // par ailleurs que la fonction est virtuelle, donc bon...
    symbol.declarations = revision.listSymbolDeclarations(symbol.id);
    for (let decl of symbol.declarations) {
      decl.filePath = revision.getFilePath(decl.fileId);
      delete decl.fileId;
    }
  }

  return symbol;
}

module.exports = {
  getSnapshotSymbolInfoLegacy,
  getSnapshotSymbolInfo
};
