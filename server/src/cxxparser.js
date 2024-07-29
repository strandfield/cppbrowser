

const CXX = require('@lezer/cpp');
const LezerHighlight = require('@lezer/highlight');

function parseCXX(text) {
    return CXX.parser.parse(text);
}

function highlightTree(tree, putStyle) {
    LezerHighlight.highlightTree(tree, LezerHighlight.classHighlighter, putStyle);
}

function highlightCode(code, tree, emit, emitBreak) {
    LezerHighlight.highlightCode(code, tree, LezerHighlight.classHighlighter, emit, emitBreak);
}

module.exports = {
    parseCXX,
    highlightTree,
    highlightCode
};
