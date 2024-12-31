

import { NavTooltip, CodeViewer } from '@cppbrowser/codebrowser'

var codepre = document.getElementById('srccode');
let filecontent = codepre.innerText;

let tooltip = new NavTooltip(document.getElementById('content'));
let navigator = new CodeViewer(codepre.parentElement, tooltip);

navigator.setPlainText(filecontent);

export {
    tooltip,
    navigator
};