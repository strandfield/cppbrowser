<script setup>

import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'

import { parser } from "@lezer/cpp"
import { highlightTree, classHighlighter } from "@lezer/highlight"

import $ from 'jquery'

const props = defineProps({
  projectName: String,
  projectRevision: String,
  pathParts: Array
});

onMounted(() => {
  console.log(`fileview is now mounted.`);
  fetchFileContent();
});

const router = useRouter();

const sourceCode = ref("");

const filePath = computed(() => props.pathParts.join("/"));

const site = {
  baseUrl: "/snapshots"
};

let lineviews = [];
let ast = null;
let diagnosticLevels = [];
let diagnostics = [];
let includes = [];
let sema = null;
let symdefs = null;

watch(() => props.projectName + "/" + props.projectRevision + "/" + props.pathParts.join("/"), fetchFileContent, { immediate: false });

function setFileContent(data) {
  sourceCode.value = data;

  let filecontent = data;
  let lines = filecontent.split('\n');

  var codetable = document.createElement('TABLE');
  codetable.setAttribute('class', "code")
  var tablebody = document.createElement('TBODY');
  codetable.appendChild(tablebody);

  let offset = 0;

  for (const i in lines) {
    let line = lines[i];

    var tr = document.createElement('TR');

    var linenum = document.createElement('TH');
    linenum.innerText = (Number.parseInt(i) + 1);
    linenum.setAttribute('id', "L" + linenum.innerText);
    tr.appendChild(linenum);
    var linecontent = document.createElement('TD');
    linecontent.innerText = line;
    tr.appendChild(linecontent);

    linecontent.offset = offset;
    offset += line.length + 1;
    lineviews.push(linecontent);

    tablebody.appendChild(tr);
  }

  let srccodecontainer = document.getElementById("srccodecontainer");
  srccodecontainer.replaceChildren(codetable);

  console.log(lineviews);
}

function fetchFileContent() {
  sourceCode.value = "";
  lineviews = [];
  ast = null;
  diagnosticLevels = [];
  diagnostics = [];
  includes = [];
  sema = null;
  symdefs = null;

  $.get(`/api/snapshots/${props.projectName}/${props.projectRevision}/files/${props.pathParts.join("/")}`, (data) => {
      setFileContent(data);
      fetchSema();
  });
}

function genToks(text, lineviews, styles) {
    let tokens = [];

    for (const style of styles) {
        let from = style.from;
        let i = text.indexOf('\n', from);

        while (i != -1 && i < style.to) {
            tokens.push({
                from: from,
                to: i,
                classes: style.classes
            });
            from = i+1;
            i = text.indexOf('\n', from);
        }

        tokens.push({
            from: from,
            to: style.to,
            classes: style.classes
        });
    }

    return tokens;
}
 
let codeIsHighlighted = false;

function doHighlightCode() {
  ast = parser.parse(sourceCode.value);
  console.log(ast);

  codeIsHighlighted = true;

  let curlineindex = -1;
  let curlineview = null;

  function fetchNextLine() {
    curlineindex += 1;
    if (lineviews.length > curlineindex) {
      curlineview = lineviews[curlineindex];
      curlineview.innerHTML = '';
    } else {
      curlineview = null;
    }
  }

  fetchNextLine();

  let SymRefIterator = {
    refs: sema?.references ?? [],
    index: 0,
    getRefsAtOffset(offset) {
      while (this.index < this.refs.length && this.refs[this.index].offset < offset) {
        console.log(`@ ${offset} skipping ref #${this.index}: ${JSON.stringify(this.refs[this.index])}`);
        this.index++;
      }

      let result = null;

      while (this.index < this.refs.length && this.refs[this.index].offset == offset) {
        if (result == null) {
          result = this.refs[this.index];
        } else if (Array.isArray(result)) {
          result.push(this.refs[this.index]);
        } else {
          result = [result, this.refs[this.index]];
        }

        this.index++;
      }

      return result;
    },
    // TODO: create a function that returns primary ref and secondary refs
    selectRef(refs, text) {
      if (!refs) {
        return null;
      } else if (!Array.isArray(refs)) {
        return refs;
      }

      let goodname = refs.filter(e => GetSymbol(e).name == text);
      if (goodname.length == 1) {
        return goodname[0];
      }

      if (goodname.length == 2) {
        if (SymbolIs(goodname[0], 'variable') && SymbolIs(goodname[1], 'constructor')) {
          return goodname[0];
        } else if (SymbolIs(goodname[1], 'variable') && SymbolIs(goodname[0], 'constructor')) {
          return goodname[1];
        }

        if (SymbolIs(goodname[0], 'class') && SymbolIs(goodname[1], 'constructor')) {
          return goodname[1];
        } else if (SymbolIs(goodname[1], 'class') && SymbolIs(goodname[0], 'constructor')) {
          return goodname[0];
        }
      }

      let reflist = refs.map(e => e.symbolId);
      console.log(`Multiple refs @${refs[0].line}:${refs[0].col} near "${text}": ${JSON.stringify(reflist)}`);
      return refs[0];
    }
  };

  function emit(text, offset, classes) {
    let symrefs = SymRefIterator.getRefsAtOffset(offset);
    let symref = SymRefIterator.selectRef(symrefs, text);

    let node = document.createTextNode(text);
    if (classes || symref) {
      let tagname = "span";
      let symdef = null;
      let symdefsfiles = symdefs.files;
      let tagid = null;
      // TODO: utiliser les flags de la ref pour savoir si on est au niveau de la definition ?
      if (symref && symdefs.definitions[symref.symbolId] && !Array.isArray(symdefs.definitions[symref.symbolId])) {
        symdef = symdefs.definitions[symref.symbolId];
        let isatdef = (symdefsfiles[symdef.fileid] == filePath.value && symdef.line == curlineindex + 1);
        let islocalsym = IsLocalSymbol(sema.symbols[symref.symbolId]);
        if (!isatdef && !islocalsym) {
          tagname = "a";
        } else {
          if (isatdef) {
            tagid = symref.symbolId;
          }
          symdef = null;
        }
      }

      let span = document.createElement(tagname);

      if (tagid) {
        span.setAttribute('id', tagid);
      }

      if (symref) {
        let symbol = sema.symbols[symref.symbolId];
        // TODO: regarder quand le nom du symbol diffère du 'text' à écrire
        if (symbol) {
          let k = sema.symbolKinds[symbol.kind];
          if (k == 'namespace') {
            span.classList.add("namespace");
          } else if (k == 'enum-constant') {
            span.classList.add("enumconstant");
          } else if (k == 'field') {
            span.classList.add("field");
          } else if (k == 'function') {
            span.classList.add("fn");
          } else if (k == 'instance-method') {
            span.classList.add("memfn");
          } else if (k == 'static-method') {
            span.classList.add("staticfn");
          } else if (k == 'constructor') {
            span.classList.add("constructor");
          } else if (k == 'destructor') {
            span.classList.add("destructor");
          } else if (k == 'enum' || k == 'class' || k == 'struct' || k == 'union') {
            span.classList.add("type");
          }

          span.setAttribute("sym-id", symbol.id);
        }

        if (symdef) {
          let path = symdefsfiles[symdef.fileid];
          let target_url = `${site.baseUrl}/${props.projectName}/${props.projectRevision}/files/${path}#${symref.symbolId}`;
          span.setAttribute('href', target_url);
          span.onclick = () => {
            router.push({ name: 'file', params: { 
              projectName: props.projectName, 
              projectRevision: props.projectRevision,
              pathParts: path.split("/")
            } });
            return false; // ignore the 'href' when clicking
          };
        }
      }
      if (classes && span.classList.length == 0) {
        if (text == 'int' || text == 'bool') {
          span.className = 'tok-keyword';
        } else {
          span.className = classes;
        }

      }
      span.appendChild(node);
      node = span;
    }
    curlineview.appendChild(node);
  }

  function emitBreak() {
    fetchNextLine();
  }
  // window.highlightCode(filecontent, ast, emit, emitBreak);

  let styles = [];
  function putStyle(from, to, classes) {
    styles.push({
      from: from,
      to: to,
      classes: classes
    });
  }


  highlightTree(ast, classHighlighter, putStyle);

  let tokens = genToks(sourceCode.value, lineviews, styles);

  let tokenindex = 0;
  function hasTok() { return tokenindex < tokens.length; }
  function curTok() {
    return tokens[tokenindex];
  }
  function readTok() {
    tokenindex += 1;
    return tokens[tokenindex - 1];
  }

  let filecontent = sourceCode.value;
  let lines = filecontent.split('\n');

  while (curlineview) {
    let offset = curlineview.offset;
    let endoffset = offset + lines[curlineindex].length;

    while (hasTok() && curTok().from < endoffset) {
      let token = readTok();

      if (token.from > offset) {
        emit(filecontent.substring(offset, token.from), offset);
      }

      emit(filecontent.substring(token.from, token.to), token.from, token.classes);

      offset = token.to;
    }

    if (offset < endoffset) {
      emit(filecontent.substring(offset, endoffset));
    }

    emitBreak();
  }
}


function GetRefFlags(ref) {
    return {
        declaration: Boolean(ref.flags & sema.refFlags.declaration),
        definition: Boolean(ref.flags & sema.refFlags.definition),
        read: Boolean(ref.flags & sema.refFlags.read),
        write: Boolean(ref.flags & sema.refFlags.write),
        call: Boolean(ref.flags & sema.refFlags.call),
        addressof: Boolean(ref.flags & sema.refFlags.addressof),
        implicit: Boolean(ref.flags & sema.refFlags.implicit)
    };
}

function SymbolIs(s, what) {
    if (!s) {
        return false;
    } else if (s.kind) {
        return sema.symbolKinds[s.kind] == what;
    } else if (s.symbolId) {
        return SymbolIs(sema.symbols[s.symbolId], what);
    } else if (typeof(s) == 'string') {
        return SymbolIs(sema.symbols[s], what);
    } else {
        return false;
    }
}

function IsLocalSymbol(s) {
    return (s.flags & 1)
}

function GetSymbol(q) {
    if (q.symbolId) {
        return sema.symbols[q.symbolId];
    } else if (typeof(q) == 'string') {
        return sema.symbols[q];
    } else {
        return null;
    }
}

function GetSymbols(list) {
    return list.map(e => GetSymbol(e));
}

function insertIncludes() {
  if (!codeIsHighlighted) {
    doHighlightCode();
  }

  for (const include of includes) {
    let line = include.line;
    let th = document.getElementById("L" + line);
    if (!th) {
      continue;
    }
    let td = th.nextElementSibling;
    let span = td.querySelector('.tok-string, .tok-string2');
    if (!span) {
      continue;
    }
    span.setAttribute('class', "include");
    let a = document.createElement('A');
    a.setAttribute('href', `${site.baseUrl}/${props.projectName}/${props.projectRevision}/files/${include.included.path}`);

    a.onclick = () => {
            router.push({ name: 'file', params: { 
              projectName: props.projectName, 
              projectRevision: props.projectRevision,
              pathParts: include.included.path.split("/")
            } });
            return false; // ignore the 'href' when clicking
          };

    a.innerText = span.innerText;
    span.innerText = "";
    span.appendChild(a);
  }
}

function insertDiagnostics() {
  for (let diagnostic of diagnostics) {
    let level = diagnosticLevels[diagnostic.level];
    if (level == 'ignored') {
      continue;
    }

    let line = diagnostic.line;
    let th = document.getElementById("L" + line);
    if (!th) {
      continue;
    }

    th.setAttribute('class', " diagnostic-" + level);
    th.setAttribute('title', diagnostic.message);
  }
}



function preprocessSema() {
  let s = sema.references.length;
  sema.references = sema.references.filter(ref => !(ref.flags & sema.refFlags.implicit));
  if (sema.references.length < s) {
    console.log(`Removed ${s - sema.references.length} implicit references`);
  }

  sema.references.forEach(ref => {
    ref.offset = lineviews[ref.line - 1].offset + (ref.col - 1);
  });

  sema.references.sort((a, b) => { return a.offset - b.offset; });
}
 
function setupSema(data) {
    diagnosticLevels = data.sema.diagnosticLevels;
    diagnostics = data.sema.diagnostics;
    includes = data.sema.includes;
    sema = data.sema.symrefs;
    if (sema?.references) {
        preprocessSema();
    }    
    symdefs = data.sema.symdefs;
}

function fetchSema() {
    if (!$) {
        console.log("jquery is not available");
        return;
    }

    const url = `/api/snapshots/${props.projectName}/${props.projectRevision}/sema/${props.pathParts.join("/")}`;
    $.get(url, function (data) {
        console.log(data);
        if (!data || !data.success) {
            console.log("error while fetching file's sema");
            // TODO: highlight code using heuristic only
            return;
        }

        setupSema(data);
        doHighlightCode();
        insertIncludes();
        insertDiagnostics();

        if (location.hash) {
            // https://stackoverflow.com/questions/3163615/how-to-scroll-an-html-page-to-a-given-anchor
            let element_to_scroll_to = $(location.hash)[0];
            element_to_scroll_to.scrollIntoView();
        }      
    });
}


</script>

<template>
  <div>
    <h2>{{ projectName }}/{{ projectRevision }}/{{ pathParts.join("/") }}</h2>
    <div id="srccodecontainer"></div>
  </div>
</template>
