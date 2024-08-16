

const { ProjectRevision, Project } = require('./project.js');

const fs = require('fs');

class ProjectManager
{
    constructor(directory) {
        this.directory = directory;

        this.projects = {};

        fs.readdirSync(directory).forEach(file => {
            if (file.endsWith('.db')) {
                try {
                    let project_revision = new ProjectRevision(directory + "/" + file);
                    let project = this.#getOrCreateProject(project_revision.projectName);
                    project.addRevision(project_revision);
                } catch(ex) {
                    console.log(ex);
                }
            }
          });
    }

    static globalInstance = null;

    static initGlobalInstance(directory) {
        ProjectManager.globalInstance = new ProjectManager(directory);
    }

    getProjectByName(name) {
        return this.projects[name];
    }

    getProjects() {
        let list = [];
        for (let key in this.projects) {
            list.push(this.projects[key]);
        }
        return list;
    }

    #getOrCreateProject(name) {
        let p = this.projects[name];
        if (!p) {
            p = new Project(name);
            this.projects[name] = p;
        }
        return p;
    }

    addProjectRevision(dbName) {
        try {
            let project_revision = new ProjectRevision(this.directory + "/" + dbName);
            let project = this.#getOrCreateProject(project_revision.projectName);
            project.addRevision(project_revision);
            return true;
        } catch(ex) {
            console.log(ex);
        }

        return false;
    }

    removeProject(name) {
        let p = this.projects[name];
        if (!p) {
            return false;
        }

        Project.destroy(p);
        delete this.projects[name];
        return true;
    }
};

module.exports = ProjectManager;
