
import { symbolKinds, symbol_isLocal, symbolReference_isImplicit } from '@cppbrowser/snapshot-tools';

import { parser as lezerCxxParser } from '@lezer/cpp';
import { highlightTree as lezerHighlightTree, classHighlighter as lezerClassHighlighter } from '@lezer/highlight';

/**
 * @brief the navigation tool tip
 */
export class NavTooltip
{
    element = null;
    parentElement = null;
    hideDelay = 200;
    showDelay = 350;
    normalHideDelay = 200;
    focusHideDelay = 500;

    constructor(parentElement = null) {
        this.element = document.createElement('div');
        this.element.setAttribute('id', 'tooltip');
        this.element.setAttribute('style', "position: absolute; display: none;");
        if (!parentElement) {
            parentElement = document.getElementsByTagName('BODY')[0];
        }
        parentElement.appendChild(this.element);
        this.parentElement = parentElement;
        this.element.addEventListener('mouseover', e => { 
          this.hideDelay = this.focusHideDelay;
          clearTimeout(this.hideTimerId);
        });
        this.element.addEventListener('mouseout', e => { 
          this.hideAfterDelay();
        });

        this.srcElement = null; // the element that trigerred the tooltip
        this.showTimerId = null;
        this.hideTimerId = null;
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
        let docwidth = this.parentElement.clientWidth - 15;
        let contentTop = this.parentElement.offsetTop;
        let winheight = window.innerHeight - 18 - contentTop;
        let toppos = window.scrollY + contentTop;
        let twidth = this.element.offsetWidth;
        let theight = this.element.offsetHeight;
        let tipx = geom.left + geom.width / 2 - twidth / 2;
        tipx += this.parentElement.scrollLeft;
        if (tipx + twidth > docwidth) tipx = docwidth - twidth - this.gap;
        else if (tipx < 0) tipx = this.gap;
        let tipy = geom.top + geom.height / 2 + this.gap;
        tipy += this.parentElement.scrollTop;
        tipy = (tipy - toppos + theight > winheight && tipy - theight > toppos) ? tipy - theight - (2 * this.gap) : tipy //account for bottom edge
        this.srcElement = elem;
        this.element.style.left = tipx + 'px';
        this.element.style.top = tipy + 'px';
    }

    showAfterDelay(elem, beforeShow) {
        clearTimeout(this.showTimerId);
        this.showTimerId = setTimeout(() => {
            clearTimeout(this.hideTimerId);
            if (beforeShow)
                beforeShow();
            this.element.style.display = 'block';
            this.setUnderElem(elem);
            this.hideDelay = this.normalHideDelay;
        }, this.showDelay);
    }

    hide() {
        this.element.style.display = 'none';
    }

    hideAfterDelay() {
        clearTimeout(this.showTimerId);
        clearTimeout(this.hideTimerId);
        this.hideTimerId = setTimeout(() => this.hide(), this.hideDelay);
    }

    setHtml(html) {
        this.element.innerHTML = html;
    }

    setDOMContent(contentElement) {
        this.element.replaceChildren(contentElement);
    }
};

export class TextDocument {
    lines = [];
    ast = null;
    sema = null;
    #lineHasComment = [];
    #commentLinesListed = false;
    #lineOffsets = [];

    constructor(text = null) {
        if (text) {
            this.setPlainText(text);
        }
    }

    setPlainText(text) {
        this.lines = text.split("\n");
        this.#lineOffsets = [];
        this.#lineHasComment = [];
        this.#commentLinesListed = false;
        this.clearAst();
        this.clearSema();

        let offset = 0;

        for (const i in this.lines) {
            let line = this.lines[i];
            this.#lineOffsets.push(offset);
            offset += line.length + 1;
            this.#lineHasComment.push(false);
        }
    }

    toPlainText() {
        return this.lines.join("\n");
    }

    numberOfLines() {
        return this.lines.length;
    }

    getLineOffset(index) {
        return this.#lineOffsets[index];
    }

    getOffsetByLineNumber(lineNumber) {
        return this.getLineOffset(lineNumber-1);
    }

    getSema() {
        return this.sema;
    }

    setSema(sema) {
        this.sema = sema;
    }

    clearSema() {
        this.setSema(null);
    }

    getAst() {
        return this.ast;
    }

    setAst(ast) {
        this.ast = ast;
    }

    clearAst() {
        this.setAst(null);
    }

    getOrCreateAst() {
        if (!this.ast) {
            const text = this.toPlainText();
            this.ast = lezerCxxParser.parse(text);
        }

        return this.ast;
    }


    #getNodeType(name) {
        for (const elem of lezerCxxParser.nodeSet.types) {
            if (elem.name == name) {
                return elem.id;
            }
        }
        return null;
    }

    hasCommentInformation() {
        return this.#commentLinesListed;
    }

    listCommentLines() {
        if (this.#commentLinesListed) return;

        const ast = this.getOrCreateAst();
        const linecomment = this.#getNodeType("LineComment");
        const blockcomment = this.#getNodeType("BlockComment");
        let cursor = ast.cursor();

        let comments = [];
        
        cursor.iterate((node)=>{
            if (node.type.id == linecomment || node.type.id == blockcomment) {
                comments.push({
                    from: node.from,
                    to: node.to
                });
            }
        });

        let i = 0;
        let j = 0;

        while (i < this.lines.length && j < comments.length)
        {
            const offset = this.getLineOffset(i);
            const line = this.lines[i];
            const comment = comments[j];

            if (offset > comment.to) {
                ++j;
                continue;
            } else if (offset + line.length < comment.from) {
                ++i;
                continue;
            }

            this.#lineHasComment[i] = true;
            ++i;
        }

        this.#commentLinesListed = true;
    }

    lineHasComment(i) {
        return this.#lineHasComment[i];
    }

    getHasCommentByLineNumber(lineNum) {
        return this.lineHasComment(lineNum - 1);
    }
}

class SemaHelper {
    sema = null;

    constructor(sema) {
        this.sema = sema;
    }

    symbolIs(s, what) {
        // TODO: review/redesign sema json, it has weird structure
        if (!s) {
            return false;
        } else if (s.kind) {
            return symbolKinds.names[s.kind] == what;
        } else if (s.symbolId) {
            return this.symbolIs(this.sema.symrefs.symbols[s.symbolId], what);
        } else if (typeof(s) == 'string') {
            return this.symbolIs(this.sema.symrefs.symbols[s], what);
        } else {
            return false;
        }
    }

    static isLocal(s) {
        return (s.flags & 1)
    }

}

class ArrayIterator {
    array = [];
    currentIndex = 0;

    constructor(array) {
        this.array = array;
    }

    atEnd() {
        return this.currentIndex >= this.array.length;
    }

    value() {
        return this.array[this.currentIndex];
    }

    next() {
        this.currentIndex += 1;
        return this.atEnd() ? undefined : this.value();
    }
}

class AnnotationIterator extends ArrayIterator {
    
    seek(offset) {
        while (!this.atEnd() && this.value().offset < offset) {
            this.next();
        }

        if (!this.atEnd() && this.value().offset == offset) {
            return this.value();
        } else {
            return null;
        }
    }
}

class SymbolReferencesConsumer {
    refs = [];
    index = 0;

    constructor(sema) {
        this.sema = sema;
        this.refs = sema?.symrefs?.references ?? [];
        this.semaHelper = new SemaHelper(sema);
    }

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
    }

    getSymbol(q) {
        if (q.symbolId) {
            return this.sema.symrefs.symbols[q.symbolId];
        } else if (typeof(q) == 'string') {
            return this.sema.symrefs.symbols[q];
        } else {
            return null;
        }
    }
}

class SyntaxHighlighter {
    textDocument = null;
    text = null;
    tds = null;
    linksGenerator = null;

    currentLineIndex = -1;
    currentTD = null;

    constructor(textDocument, tds, linksGenerator) {
        this.textDocument = textDocument;
        this.tds = tds;
        this.linksGenerator = linksGenerator;
    }

    #fetchNextLine() {
        this.currentLineIndex += 1;
        if (this.tds.length > this.currentLineIndex) {
            this.currentTD = this.tds[this.currentLineIndex];
            this.currentTD.innerHTML = '';
        } else {
            this.currentTD = null;
        }
    }


    #generateTokens(styles) {
        const text = this.text;
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
                from = i + 1;
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

    #addCssClassesBasedOnSymbolKind(element, symbol) {
        let k = symbolKinds.names[symbol.kind];
        if (k == 'namespace') {
            element.classList.add("namespace");
        } else if (k == 'enum-constant') {
            element.classList.add("enumconstant");
        } else if (k == 'field') {
            element.classList.add("field");
        } else if (k == 'function') {
            element.classList.add("fn");
        } else if (k == 'method') {
            element.classList.add("memfn");
        } else if (k == 'static-method') {
            element.classList.add("staticfn");
        } else if (k == 'constructor') {
            element.classList.add("constructor");
        } else if (k == 'destructor') {
            element.classList.add("destructor");
        } else if (k == 'enum' || k == 'class' || k == 'struct' || k == 'union') {
            element.classList.add("type");
        } else if (k == 'variable') {
            element.classList.add("var");

            if (symbol_isLocal(symbol)) {
                element.classList.add("local");
            }
        }
    }

    #emit(text, offset, classes) {
        let symdefs = this.textDocument.getSema().symdefs;
        let symrefs = this.textDocument.getSema().symrefs;

        let arg_passed_by_ref = this.argumentsPassedByRef.seek(offset);
        if (arg_passed_by_ref) {
            let node = document.createElement("span");
            node.classList.add("refarg");
            node.setAttribute('title', "Argument passed by reference");
            this.currentTD.appendChild(node);
        }

        let references_at_offset = this.symrefs_consumer.getRefsAtOffset(offset);
        let primary_ref = null;
        let secondary_refs = [];
        if (Array.isArray(references_at_offset)) {
            references_at_offset.sort((a,b) => symbolReference_isImplicit(a) - symbolReference_isImplicit(b));
            primary_ref = references_at_offset[0];
            secondary_refs = references_at_offset.slice(1);
        } else {
            primary_ref = references_at_offset;
        }

        for (const ref of secondary_refs) {         
            let link_object = null;
            if (symdefs.definitions[ref.symbolId] && !Array.isArray(symdefs.definitions[ref.symbolId])) {
                let symdef = symdefs.definitions[ref.symbolId];
                let path = symdefs.files[symdef.fileid];
                link_object = this.linksGenerator?.createLinkToSymbolDefinition(path, ref.symbolId);
            }

            let elem = document.createElement(link_object ? "a" : "span");

            elem.classList.add("impref");

            {
                let symbol = symrefs.symbols[ref.symbolId];
                if (symbol) {
                    this.#addCssClassesBasedOnSymbolKind(elem, symbol);
                    elem.setAttribute("sym-id", symbol.id);
                }

                if (link_object) {
                    elem.setAttribute('href', link_object.href);
                    if (link_object.onclick) {
                        elem.onclick = link_object.onclick;
                    }
                }
            }

            if (classes && elem.classList.length == 0) {
                if (text == 'int' || text == 'bool') {
                    elem.className = 'tok-keyword';
                } else {
                    elem.className = classes;
                }

            }
            this.currentTD.appendChild(elem);
        }

        let node = document.createTextNode(text);
        if (classes || primary_ref) {
            let link_object = null;
            let elemid = null;
            // TODO: utiliser les flags de la ref pour savoir si on est au niveau de la definition ?
            if (primary_ref && symdefs.definitions[primary_ref.symbolId] && !Array.isArray(symdefs.definitions[primary_ref.symbolId])) {
                let symdef = symdefs.definitions[primary_ref.symbolId];
                let isatdef = (symdef.fileid == this.fileInfo.id && symdef.line == this.currentLineIndex + 1);
                let islocalsym = SemaHelper.isLocal(symrefs.symbols[primary_ref.symbolId]);
                if (!isatdef && !islocalsym) {
                    let path = symdefs.files[symdef.fileid];
                    link_object = this.linksGenerator?.createLinkToSymbolDefinition(path, primary_ref.symbolId);
                } else {
                    // TODO: si on est pas en mode "document", on voudrait quand même potentiellement créer un lien
                    // même si on est au niveau de la définition (sauf si on est sur la page de l'élément).
                    if (isatdef) {
                        elemid = primary_ref.symbolId;
                    }
                }
            }

            let span = document.createElement(link_object ? "a" : "span");

            if (elemid) {
                span.setAttribute('id', elemid);
            }

            if (primary_ref) {
                let symbol = symrefs.symbols[primary_ref.symbolId];
                if (symbol) {
                    this.#addCssClassesBasedOnSymbolKind(span, symbol);
                    span.setAttribute("sym-id", symbol.id);
                }

                if (link_object) {
                    span.setAttribute('href', link_object.href);
                    if (link_object.onclick) {
                        span.onclick = link_object.onclick;
                    }
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
        this.currentTD.appendChild(node);
    }

    run(fileInfo) {
        this.fileInfo = fileInfo;
        this.currentLineIndex = -1;
        this.currentTD = null;

        this.text = this.textDocument.toPlainText();
        const sema = this.textDocument.getSema();

        const ast = this.textDocument.getOrCreateAst();

        let styles = [];
        let putStyle = function (from, to, classes) {
            styles.push({
                from: from,
                to: to,
                classes: classes
            });
        }
        lezerHighlightTree(ast, lezerClassHighlighter, putStyle);

        let tokens = this.#generateTokens(styles);
        let token_iterator = new ArrayIterator(tokens);

        this.symrefs_consumer = new SymbolReferencesConsumer(sema);
        this.argumentsPassedByRef = new AnnotationIterator(sema.annotations?.refargs ?? []);

        let emit = (text, offset, classes) => {
            this.#emit(text, offset, classes);
        }

        let emitBreak = () => {
            this.#fetchNextLine();
        }

        this.#fetchNextLine();

        while (this.currentTD) {
            let offset = this.textDocument.getLineOffset(this.currentLineIndex);
            let endoffset = offset + this.textDocument.lines[this.currentLineIndex].length;

            while (!token_iterator.atEnd() && token_iterator.value().from < endoffset) {
                let token = token_iterator.value();
                token_iterator.next();

                if (token.from > offset) {
                    emit(this.text.substring(offset, token.from), offset);
                }

                emit(this.text.substring(token.from, token.to), token.from, token.classes);

                offset = token.to;
            }

            if (offset < endoffset) {
                emit(this.text.substring(offset, endoffset));
            }

            emitBreak();
        }

        this.symrefs_consumer = null;
        this.text = null;
    }
}

export class CodeViewer {
    containerElement = null;
    tooltip = null;
    linksGenerator = null;
    textDocument = null;
    #tds = [];
    #highlightedSymbolId = "";
    #lineRange = null;
    documentMode = true;

    constructor(containerElement, tooltip = null) {
        console.assert(containerElement != null);

        this.containerElement = containerElement;
        this.tooltip = tooltip;
        this.textDocument = new TextDocument();
    }

    setPlainText(text) {
        this.textDocument.setPlainText(text);
        this.textDocument.listCommentLines();


        let table = document.createElement('TABLE');
        table.setAttribute('class', "code")
        let tbody = document.createElement('TBODY');
        table.appendChild(tbody);

        this.#tds = [];

        for (const i in this.textDocument.lines) {
            const line = this.textDocument.lines[i];

            let tr = document.createElement('TR');

            //// for debugging purpose
            // if (this.textDocument.lineHasComment(i)) {
            //     tr.classList.add("has-comment");
            // }

            let th = document.createElement('TH');
            th.innerText = (Number.parseInt(i) + 1);
            if (this.documentMode) {
                th.setAttribute('id', "L" + th.innerText);
            } else {
                // TODO: generate link ?
            }

            tr.appendChild(th);
            let td = document.createElement('TD');
            td.innerText = line;
            tr.appendChild(td);

            this.#tds.push(td);

            tbody.appendChild(tr);
        }

        this.containerElement.replaceChildren(table);

        table.addEventListener('mouseover', e => {
            this.highlight(e.target.getAttribute('sym-id'));
            this.showTooltip(e.target);
        });

        table.addEventListener('mouseout', e => {
            this.highlight('');
        });
    }

    toPlainText() {
        return this.textDocument.toPlainText();
    }

    numberOfLines() {
        return this.textDocument.numberOfLines();
    }

    getFirstLine() {
        return this.#lineRange ? this.#lineRange.first : 1;
    }

    getLastLine() {
        return this.#lineRange ? this.#lineRange.last : this.numberOfLines();
    }

    setLineRange(first, last) {
        this.#lineRange = {
            first: first,
            last: last < 0 ? this.numberOfLines() : last
        };

        for (const i in this.textDocument.lines) {
            const linenum = Number(i)+1;
            const td = this.#tds[i];

            if (linenum < first || linenum > last) {
                td.parentElement.style.display = "none";
            } else {
                td.parentElement.style.display = "table-row";
            }
        }
    }

    setLinksGenerator(linksGenerator) {
        this.linksGenerator = linksGenerator;
    }

    #linecolToOffset(l, c) {
        return this.textDocument.getOffsetByLineNumber(l) + (c - 1);
    }

    #sortByOffset(array) {
        array.sort((a, b) => { return a.offset - b.offset; });
    }

    #preprocessSema(sema) {
        {
            let symrefs = sema.symrefs;

            symrefs.references.forEach(ref => {
                ref.offset = this.textDocument.getOffsetByLineNumber(ref.line) + (ref.col - 1);
            });

            symrefs.references.sort((a, b) => { return a.offset - b.offset; });
        }

        if (sema.annotations?.refargs)
        {
            let refargs = sema.annotations.refargs;
            refargs.forEach(e => { 
                e.offset = this.#linecolToOffset(e.line, e.column);
            });
            this.#sortByOffset(refargs);
        }
    }

    setSema(fileInfo, sema) {
        this.fileInfo = fileInfo;
        this.textDocument.setSema(sema);

        this.#preprocessSema(sema);

        let highlighter = new SyntaxHighlighter(this.textDocument, this.#tds, this.linksGenerator);
        highlighter.run(this.fileInfo);

        for (const include of sema.includes) {
            let line = include.line;
            let td = this.#getLineTdByNumber(line);
            let span = td.querySelector('.tok-string, .tok-string2');
            if (!span) {
                continue;
            }
            span.setAttribute('class', "include");
            let link_object = this.linksGenerator?.createIncludeLink(include.included.path);
            if (link_object) {
                let a = document.createElement('A');
                a.setAttribute('href', link_object.href);
                if (link_object.onclick) {
                    a.onclick = link_object.onclick;
                }
                a.innerText = span.innerText;
                span.innerText = "";
                span.appendChild(a);
            }
        }

        for (let diagnostic of sema.diagnostics) {
            let level = sema.diagnosticLevels[diagnostic.level];
            if (level == 'ignored') {
                continue;
            }

            let line = diagnostic.line;
            let th = this.#getLineThByNumber(line);
            if (!th) {
                continue;
            }

            th.setAttribute('class', " diagnostic-" + level);
            th.setAttribute('title', diagnostic.message);
        }
    }

    highlight(symbolId) {
        if (symbolId == this.#highlightedSymbolId)
            return;

        if (this.#highlightedSymbolId != "") {
            let highlighted_elements = document.querySelectorAll(`[sym-id="${this.#highlightedSymbolId}"]`);
            highlighted_elements.forEach(function (e) {
                e.classList.remove('highlight');
            });
        }

        if (symbolId != "") {
            let elems_to_highlight = document.querySelectorAll('[sym-id="' + symbolId + '"]');
            elems_to_highlight.forEach(function (e) {
                e.classList.add('highlight');
            });
        }

        this.#highlightedSymbolId = symbolId;
    }

    #getLineTdByNumber(n) {
        return this.#tds[n-1];
    }

    #getLineThByNumber(n) {
        return this.#getLineTdByNumber(n)?.previousElementSibling;
    }

    #getParentTD(elem) {
        if (elem.tagName == 'TD') return elem;
        else return this.#getParentTD(elem.parentElement);
    }

    #getLine(elem) {
        return this.#getParentTD(elem).previousSibling.id.slice(1);
    }

    #fillTooltip(symid) {
        let symbol = this.textDocument.getSema().symrefs.symbols[symid];
        
        let content_element = document.createElement('DIV');

        let bold = function(txt) {
            let e = document.createElement('B');
            e.innerText = txt;
            content_element.appendChild(e);
        }

        let text = function(txt) {
            content_element.appendChild(document.createTextNode(txt));
        };

        let br = function() {
            content_element.appendChild(document.createElement('BR'));
        };

        {
            bold(symbol.name);
            br();
        }

        // TODO: broken, reimplement me
        if (symbol.type) {
            text(`Type: ${symbol.type}`);
            br();
        }

        // TODO: broken, reimplement me
        if (symbol.value) {
            text(`Value: ${symbol.value}`);
            br();
        }

        if (this.documentMode)
        {
            let references = document.querySelectorAll('[sym-id="' + symid + '"]');
            text(`${references.length} reference(s) in this document:`);
            br();
            references.forEach(ref => {
                text(`Line ${this.#getLine(ref)}`);
                br();
            });
        }

        if (!SemaHelper.isLocal(symbol)) {
            let link_object = this.linksGenerator?.createTooltipMoreLink(symid);
            // TODO: refactor to be able to handle onclick
            if (link_object) {
                let div = document.createElement('DIV');
                div.setAttribute('style', "text-align: right;");
                let a = document.createElement('A');
                a.setAttribute('href', link_object.href);
                a.innerText = "More...";
                if (link_object.onclick) {
                    a.onclick = link_object.onclick;
                }
                div.appendChild(a);
                content_element.appendChild(div);
            }
        }
        
        this.tooltip.setDOMContent(content_element);
    }

    showTooltip(elem) {
        if (!this.tooltip) {
            return;
        }

        let symid = elem.getAttribute('sym-id');
        
        if(symid != null && symid != "") {
          this.tooltip.showAfterDelay(elem, () => this.#fillTooltip(symid));
        } else {
          this.tooltip.hideAfterDelay();
        }
      }
};
