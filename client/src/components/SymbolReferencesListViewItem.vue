<script setup>

import { symbolReference_isCall, symbolReference_isAddressOf, symbolReference_isRead, symbolReference_isWrite } from '@cppbrowser/snapshot-tools';

import { ref, onMounted, computed, inject } from 'vue'

import $ from 'jquery'

// TODO: use inject/provide for all props except filePath & references ?
const props = defineProps({
  symbolId: {
    type: String,
    required: true
  },
  projectName: {
    type: String,
    required: true
  },
  projectVersion: {
    type: String,
    required: true
  },
  fileEntry: {
    type: Object,
    required: true
  }
});

const symbolReferencesContext = inject('symbolReferencesContext');
const listViewFilters = inject('listViewFilters');

const lines = ref([]);
const pathParts = computed(() => props.fileEntry.filePath.split("/"));

const counter = computed( ()=> {
  return (listViewFilters.read.checked ? props.fileEntry.counters.read : 0) +
   (listViewFilters.write.checked ? props.fileEntry.counters.write : 0) +
   (listViewFilters.call.checked ? props.fileEntry.counters.call : 0) +
   (listViewFilters.addressOf.checked ? props.fileEntry.counters.addressOf : 0) +
   (listViewFilters.other.checked ? props.fileEntry.counters.other : 0);
});

function setFileContent(data) {
  lines.value = data.split("\n");
}

function fetchFileContent() {
  $.get(`/api/snapshots/${props.projectName}/${props.projectVersion}/files/${props.fileEntry.filePath}`, (data) => {
      setFileContent(data);
  });
}

onMounted(() => {
  fetchFileContent();
});

function getLine(n) {
  return n <= lines.value.length ? lines.value[n-1] : "";
}

function getUrlHashForLine(n) {
  return "#L" + n;
}

function getSymbolById(id) {
  if(!symbolReferencesContext) {
    return null;
  }
  const dict = symbolReferencesContext.value;
  return dict?.symbols[id];
}

  
function formattedRefCountMessage(n) {
  return n > 1 ? `${n} references` : `1 reference`;
}

function shouldShowRef(r) {
 if (symbolReference_isRead(r)) {
  return listViewFilters.read.checked;
 } else if (symbolReference_isWrite(r)) {
  return listViewFilters.write.checked;
 } else if (symbolReference_isCall(r)) {
  return listViewFilters.call.checked;
 } else if (symbolReference_isAddressOf(r)) {
  return listViewFilters.addressOf.checked;
 } else {
  return listViewFilters.other.checked;
 }
}

function getSymbolShortName(symbol) {
  let result = symbol.name;
    let i = result.indexOf("(");
    if (i!= -1) {
      result = result.substring(0, i);
    }
    return result;
}

function escapeHtmlChars(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatLine(e) {
  let text = getLine(e.line);

  const symbol = getSymbolById(props.symbolId);

  if (!symbol || text == "") {
    return escapeHtmlChars(text);
  }

  const i = e.col-1;
  let result = escapeHtmlChars(text.substring(0,i));

  const name = getSymbolShortName(symbol);
  text = text.substring(i);
  if (text.startsWith(name)) {
    result += `<span class="refhighlight">${name}</span>`;
    result += escapeHtmlChars(text.substring(name.length));
  } else {
    result += `<span class="refmarker"></span>`;
    result += escapeHtmlChars(text);
  }

  return result;
}

function formatRefFlags(e) {
  if (!e.flags) {
    return "";
  }

  let flags = [];
  if (symbolReference_isWrite(e)) {
    flags.push("write");
  }
  if (symbolReference_isRead(e)) {
    flags.push("read");
  }
  if (symbolReference_isCall(e)) {
    flags.push("call");
  }
  if (symbolReference_isAddressOf(e)) {
    flags.push("addr");
  }

  return flags.join(",");
}

function formatRefby(e) {
  const symbol = getSymbolById(e.refbySymbolId);

  if (symbol) {
    return getSymbolShortName(symbol);
  }

  return e.refbySymbolId;
}

</script>

<template>
  <h4 v-show="counter > 0">{{ fileEntry.filePath }} ({{ formattedRefCountMessage(counter) }})</h4>
  <table>
    <tbody>
      <template v-for="refEntry in fileEntry.references" :key="refEntry.line + ':' + refEntry.col">
        <tr v-show="shouldShowRef(refEntry)">
          <td><RouterLink :to="{ name: 'file', params: { projectName: projectName, projectRevision: projectVersion, pathParts: pathParts }, hash: getUrlHashForLine(refEntry.line) }">{{ refEntry.line }}</RouterLink></td>
          <td v-html="formatLine(refEntry)"></td>
          <td>{{ formatRefFlags(refEntry) }}</td>
          <td>
            <span v-if="refEntry.refbySymbolId">by</span> <RouterLink v-if="refEntry.refbySymbolId"
            :to="{ name: 'symbol', params: { projectName: projectName, projectRevision: projectVersion, symbolId: refEntry.refbySymbolId } }">{{ formatRefby(refEntry) }}</RouterLink>
            </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>

<style scoped>

table {
  font-family: 'Courier New', Courier, monospace;
}

table tr td:nth-child(3) {
  padding-left: 3em;
}

</style>
