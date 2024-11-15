

let linksGenerator = {
    createLinkToSymbolDefinition(path, symbolId) {
        return {
            href: `${site.baseUrl}/${project.name}/${project.revision}/${path}#${symbolId}`
        };
    },
    createIncludeLink(path) {
        return {
            href: `${site.baseUrl}/${project.name}/${project.revision}/${path}`
        };
    },
    createTooltipMoreLink(symbolId) {
        return {
            href: `${site.baseUrl}/${project.name}/${project.revision}/symbols/${symbolId}`
        }
    }
};

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
        if (!data || !data.success) {
            console.log("error while fetching file's sema");
            // TODO: highlight code using heuristic only
            return;
        }

        CodeBrowser.navigator.setLinksGenerator(linksGenerator);
        CodeBrowser.navigator.setSema(data.file, data.sema);

        if (location.hash) {
            // https://stackoverflow.com/questions/3163615/how-to-scroll-an-html-page-to-a-given-anchor
            let element_to_scroll_to = $(location.hash)[0];
            element_to_scroll_to.scrollIntoView();
        }      
    });
}

document.addEventListener("DOMContentLoaded", function(event) {
    fetchSema();
});
