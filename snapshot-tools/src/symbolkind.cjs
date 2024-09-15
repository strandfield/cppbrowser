const symbolKinds = {
  names: [
    "<unknown>",
    "module",
    "namespace",
    "inline-namespace",
    "namespace-alias",
    "macro",
    "enum",
    "enum-class",
    "struct",
    "class",
    "union",
    "lambda",
    "typedef",
    "type-alias",
    "enum-constant",
    "variable",
    "field",
    "static-property",
    "function",
    "method",
    "static-method",
    "constructor",
    "destructor",
    "operator",
    "conversion-function",
    "using",
    "parameter",
    "template-type-parameter",
    "template-template-parameter",
    "non-type-template-parameter",
    "concept"
  ],
  values: {
    "<unknown>": 0,
    "module": 1,
    "namespace": 2,
    "inline-namespace": 3,
    "namespace-alias": 4,
    "macro": 5,
    "enum": 6,
    "enum-class": 7,
    "struct": 8,
    "class": 9,
    "union": 10,
    "lambda": 11,
    "typedef": 12,
    "type-alias": 13,
    "enum-constant": 14,
    "variable": 15,
    "field": 16,
    "static-property": 17,
    "function": 18,
    "method": 19,
    "static-method": 20,
    "constructor": 21,
    "destructor": 22,
    "operator": 23,
    "conversion-function": 24,
    "using": 25,
    "parameter": 26,
    "template-type-parameter": 27,
    "template-template-parameter": 28,
    "non-type-template-parameter": 29,
    "concept": 30
  }
};

const selectNamespaceQuery = "SELECT id, parent, name FROM symbol WHERE kind = 2 OR kind = 3";

function symbolReference_isImplicit(symRef) {
  return (symRef.flags & 256) != 0;
}

function translateKind(k) {
  return symbolKinds.names[k];
}

function translateFlags(symbol) {

}

module.exports = {
  symbolKinds,
  selectNamespaceQuery,
  symbolReference_isImplicit
};
