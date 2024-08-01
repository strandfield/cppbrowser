
var diagnosticLevels = [];
var diagnostics = [];
var includes = [];
var sema = null;
var symdefs = null;

var codepre = document.getElementById('srccode');

let filecontent = codepre.innerText;
let lines = filecontent.split('\n');

var codetable = document.createElement('TABLE');
codetable.setAttribute('class', "code")
var tablebody = document.createElement('TBODY');
codetable.appendChild(tablebody);

let lineviews = [];
let offset = 0;

for (const i in lines) {
    let line = lines[i];

    var tr = document.createElement('TR');

    var linenum = document.createElement('TH');
    linenum.innerText = (Number.parseInt(i)+1);
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

codepre.parentElement.insertBefore(codetable, codepre.nextElementSibling);
codepre.setAttribute('style', "display: none;");

// function setLineContent(linenum, html) {
//     let th = document.getElementById("L"+linenum);
//     let td = th.nextElementSibling;
//     td.innerHTML = html;
// }

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

var ast = window.parseCXX(codepre.innerText);

// let styles = [];

// function putStyle(from, to, classes) {
//     styles.push({
//         from: from,
//         to: to,
//         classes: classes
//     });
// }

// window.highlightTree(ast, putStyle);

function testHighlightCode() {
    let result = document.createElement("pre")

    function emit(text, classes) {
        let node = document.createTextNode(text)
        if (classes) {
          let span = document.createElement("span")
          span.appendChild(node)
          span.className = classes
          node = span
        }
        result.appendChild(node)
      }
      function emitBreak() {
        result.appendChild(document.createTextNode("\n"))
      }
    
    window.highlightCode(codepre.innerText, ast, emit, emitBreak);
    codepre.parentElement.insertBefore(result, codepre.nextElementSibling);
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

var codeIsHighlighted = false;

function doHighlightCode() {
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
                let isatdef = (symdef.fileid == file.id && symdef.line == curlineindex + 1);
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
                    span.setAttribute('href', `${site.baseUrl}/${project.name}/${project.revision}/${path}#${symref.symbolId}`);
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
    window.highlightTree(ast, putStyle);

    let tokens = genToks(filecontent, lineviews, styles);

    let tokenindex = 0;
    function hasTok() { return tokenindex < tokens.length; }
    function curTok() {
        return tokens[tokenindex];
    }
    function readTok() {
        tokenindex += 1;
        return tokens[tokenindex - 1];
    }

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

function insertIncludes() {
    if (!codeIsHighlighted) {
        doHighlightCode();
    }

    for (const include of includes) {
        let line = include.line;
        let th = document.getElementById("L"+line);
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
        a.setAttribute('href', `${site.baseUrl}/${project.name}/${project.revision}/${include.included.path}`);
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
        let th = document.getElementById("L"+line);
        if (!th) {
            continue;
        }

        th.setAttribute('class', " diagnostic-" + level);
        th.setAttribute('title', diagnostic.message);
    }
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

    // TODO: would it be better if sema was retrieved from a pseudo-static (cacheable) json file
    // (e.g., "${site.baseUrl}/${project.name}/${project.revision}/.sema/${file.path}.json")
    // instead of using "api" routes ?
    const url = `/api/snapshots/${project.name}/${project.revision}/sema/${file.path}`;
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

document.addEventListener("DOMContentLoaded", function(event) {
    fetchSema();
    window.codeNavigator = new CodeNavigator();
});

class NavTooltip
{
    constructor() {
        this.htmlElement = document.createElement('div');
        this.htmlElement.setAttribute('id', 'tooltip');
        this.htmlElement.setAttribute('style', 'position: absolute');
        let content = document.getElementById('content');
        content.appendChild(this.htmlElement);
        this.htmlElement.addEventListener('mouseover', e => { 
          this.hideDelay = this.focusHideDelay;
          clearTimeout(this.hideTimerId);
        });
        this.htmlElement.addEventListener('mouseout', e => { 
          this.hideAfterDelay();
        });

        this.srcElement = null; // the element that trigerred the tooltip
        this.showTimerId = null;
        this.hideTimerId = null;
        this.showDelay = 350;
        this.normalHideDelay = 200;
        this.focusHideDelay = 500;
        this.hideDelay = 200;
        this.gap = 12;
    }

    geometry(elem) {
        let rect = elem.getBoundingClientRect();

        let geom = {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: elem.offsetWidth,
            height: elem.offsetHeight,
        };

        return geom;
    }

    setUnderElem(elem) {
        let geom = this.geometry(elem);
        let content = document.getElementById('content');
        let docwidth = content.clientWidth - 15;
        let contentTop = content.offsetTop;
        let winheight = window.innerHeight - 18 - contentTop;
        let toppos = window.scrollY + contentTop;
        let twidth = this.htmlElement.offsetWidth;
        let theight = this.htmlElement.offsetHeight;
        let tipx = geom.left + geom.width / 2 - twidth / 2;
        tipx += content.scrollLeft;
        if (tipx + twidth > docwidth) tipx = docwidth - twidth - this.gap;
        else if (tipx < 0) tipx = this.gap;
        let tipy = geom.top + geom.height / 2 + this.gap;
        tipy += content.scrollTop;
        tipy = (tipy - toppos + theight > winheight && tipy - theight > toppos) ? tipy - theight - (2 * this.gap) : tipy //account for bottom edge
        this.srcElement = elem;
        this.htmlElement.style.left = tipx + 'px';
        this.htmlElement.style.top = tipy + 'px';
    }

    showAfterDelay(elem, beforeShow) {
        clearTimeout(this.showTimerId);
        this.showTimerId = setTimeout(() => {
            clearTimeout(this.hideTimerId);
            if (beforeShow)
                beforeShow();
            this.htmlElement.style.display = 'block';
            this.setUnderElem(elem);
            this.hideDelay = this.normalHideDelay;
        }, this.showDelay);
    }

    hideAfterDelay(e) {
        clearTimeout(this.showTimerId);
        clearTimeout(this.hideTimerId);
        let tooltip = this.htmlElement;
        this.hideTimerId = setTimeout(function () {
            tooltip.style.display = 'none';
        }, this.hideDelay);
    }

    setHtml(html) {
        this.htmlElement.innerHTML = html;
    }
};

class CodeNavigator {
    constructor() {
        this.currentHighlightSym = '';
        this.tooltip = new NavTooltip();

        let code = document.querySelector('.code');
  
        code.addEventListener('mouseover', e => { 
          this.highlight(e.target.getAttribute('sym-id'));
          this.showTooltip(e.target);
        });
        
        code.addEventListener('mouseout', e => { 
          this.highlight('');
        });
    }

    highlight(sym) {
        if (sym == this.currentHighlightSym)
            return;

        if (this.currentHighlightSym != '') {
            let highlighted_elements = document.querySelectorAll('[sym-id="' + this.currentHighlightSym + '"]');
            highlighted_elements.forEach(function (e) {
                e.classList.remove('highlight');
            });
        }

        if (sym != '') {
            let elems_to_highlight = document.querySelectorAll('[sym-id="' + sym + '"]');
            elems_to_highlight.forEach(function (e) {
                e.classList.add('highlight');
            });
        }

        this.currentHighlightSym = sym;
    }

    #getParentTD(elem) {
        if (elem.tagName == 'TD') return elem;
        else return this.#getParentTD(elem.parentElement);
    }

    #getLine(elem) {
        return this.#getParentTD(elem).previousSibling.id.slice(1);
    }

    #showTooltip(elem, symid) {
        let content = "";

        let symbol = sema.symbols[symid];
        let name = symbol.displayName ?? symbol.name;
        content += `<b>${name}</b><br/>`;

        if (symbol.type) {
            content += `Type: ${symbol.type}<br/>`;
        }

        if (symbol.value) {
            content += `Value: ${symbol.value}<br/>`;
        }

        let references = document.querySelectorAll('[sym-id="' + symid + '"]');
        content += `${references.length} reference(s) in this document:<br/>`;
        references.forEach(ref => {
            content += `Line ${this.#getLine(ref)}<br/>`;
        });

        if (!IsLocalSymbol(symbol)) {
            content += `<div style='text-align: right;'><a href='${site.baseUrl}/${project.name}/${project.revision}/symbols/${symid}'>More...</a></div>`;
        }
        
        this.tooltip.showAfterDelay(elem, () => this.tooltip.setHtml(content));
    }

    showTooltip(elem) {
        let symid = elem.getAttribute('sym-id');
        
        if(symid != null && symid != '') {
          this.#showTooltip(elem, symid);
        } else {
          this.tooltip.hideAfterDelay();
        }
      }
};
