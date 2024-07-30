
import { reactive } from 'vue'
import $ from "jquery"

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
