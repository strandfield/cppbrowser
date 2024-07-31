
import { reactive } from 'vue'
import $ from "jquery"

function buildTreeFromSortedFiles(files) {
    let root_folder = {
        type: 'dir',
        name: "",
        path: "",
        children: []
    };

    let current_folder = root_folder;
    let folder_stack = [];

    let enterFolder = function(f) {
        current_folder.children.push(f);
        folder_stack.push(current_folder);
        current_folder = f;
    }

    let addFileEntryToFolder = function(path, filename = null) {
        current_folder.children.push({
            type: 'file',
            path: path,
            name: filename != null ? filename : path.substring(path.lastIndexOf("/"))
        });
    }

    let leaveFolder = function() {
        if (current_folder.path.endsWith("/")) {
            current_folder.path = current_folder.path.substring(0, current_folder.path.length - 1);
        }

        let classes = {
            "dir": 0,
            "file": 1
        };
        current_folder.children.sort((a,b) => classes[a.type] - classes[b.type]);

        current_folder = folder_stack.pop();
    }

    function add_file_to_folder(f) {
        let slash_index = f.indexOf("/", current_folder.path);

        if (slash_index == -1) { // file is exactly in current folder
            addFileEntryToFolder(f, f.substring(current_folder.path.length));
        } else { // file is in a nested folder
            let path_parts = f.substring(current_folder.path.length).split("/");
            let filename = path_parts.pop();
            for (const p of path_parts) {
                let nested_folder = {
                    type: 'dir',
                    name: p,
                    path: current_folder.path + p + "/",
                    children: []
                };
                enterFolder(nested_folder);
            }

            addFileEntryToFolder(f, filename);
        }
    }

    for (const f of files) {
        while (!f.startsWith(current_folder.path)) { // file isn't in current folder
            leaveFolder();
        }
        add_file_to_folder(f);
    }

    while (folder_stack.length > 0) {
        leaveFolder();
    }

    return root_folder;
}

const filesobj = {
    filesmap: new Map(),
    callbacks: [],
    getFilesForSnapshot(projectName, projectRevision, callback) {
        let key = projectName + "/" + projectRevision;
        let entry = this.filesmap.has(key) ? this.filesmap.get(key) : null;
        if (entry) {
            if (entry.state == 'loaded') {
                callback(projectName, projectRevision, entry.data);
                return;
            }
        }

        this.callbacks.push({
            projectName: projectName,
            projectRevision: projectRevision,
            callback: callback
        });

        if (entry?.state == 'loading') {
            return;
        }

        entry = {
            state: 'loading'
        };
        this.filesmap.set(key, entry);

        $.get(`/api/snapshots/${projectName}/${projectRevision}/files`, (data) => {
            this.handleResult(projectName, projectRevision, data);
        });
    },
    handleResult(projectName, projectRevision, data) {
        let key = projectName + "/" + projectRevision;
        let entry = this.filesmap.get(key);

        if (!data.success) {
            entry.state = 'error';
            return;
        }

        entry.state = 'loaded';
        entry.data = data;

        if (entry.data.files) {
            entry.data.files.sort();
            entry.data.tree = buildTreeFromSortedFiles(entry.data.files);
        }

        let newcallbacks = [];

        for (const callback_entry of this.callbacks) {
            if (callback_entry.projectName == projectName && callback_entry.projectRevision == projectRevision) {
                callback_entry.callback(projectName, projectRevision, entry.data);
            } else {
                newcallbacks.push(callback_entry);
            }
        }

        this.callbacks = newcallbacks;
    }
};

export const files = reactive(filesobj);
