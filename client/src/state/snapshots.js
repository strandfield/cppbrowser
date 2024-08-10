

// Reference:
// https://vuejs.org/guide/scaling-up/state-management.html
// https://vuejs.org/guide/components/provide-inject.html


import { reactive } from 'vue'
import $ from "jquery"

const snapshots_object = {
    state: 'error',
    projects: [],
    load() {
        if (this.state == 'loading' || this.state == 'loaded') {
            return;
        }

        console.log("loading snapshots");

        this.state = 'loading';

        $.get("/api/snapshots", (data) => {
            let project_map = new Map();
            for (const snap of data) {
                let p = project_map.has(snap.project) ? project_map.get(snap.project) : null;
                if (!p) {
                    p = {
                        name: snap.project,
                        revisions: []
                    };
                    project_map.set(snap.project, p);
                }

                p.revisions.push({
                    projectName: snap.project,
                    name: snap.name
                });
            }

            let project_list = [];
            project_map.forEach(value => {
                project_list.push(value);
            });
            project_list.sort((a, b) => a.name.localeCompare(b.name));

            // TODO: for each project, find the latest/default version
            this.projects = project_list;
            this.state = 'loaded';
        });
    },
    getProject(projectName) {
        if (this.state != 'loaded') {
            console.warn("getProject() called but state !== 'loaded'");
        }
        return this.projects.find(p => p.name == projectName);
    }
};

export const snapshots = reactive(snapshots_object);
