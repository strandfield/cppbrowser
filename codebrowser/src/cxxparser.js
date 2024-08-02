

import { parser } from '@lezer/cpp';
import { highlightTree as lezerHighlightTree, highlightCode as lezerHighlightCode, classHighlighter, } from '@lezer/highlight';

export function parseCXX(text) {
    return parser.parse(text);
}

export function highlightTree(tree, putStyle) {
    lezerHighlightTree(tree, classHighlighter, putStyle);
}

export function highlightCode(code, tree, emit, emitBreak) {
    lezerHighlightCode(code, tree, classHighlighter, emit, emitBreak);
}
