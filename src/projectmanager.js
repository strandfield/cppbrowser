

const Project = require('./project.js');

const fs = require('fs');

class ProjectManager
{
    constructor(directory) {
        this.directory = directory;

        this.projects = [];

        fs.readdirSync(directory).forEach(file => {
            if (file.endsWith('.db')) {
                try {
                    let p = new Project(directory + "/" + file);
                    this.projects.push(p);
                } catch(ex) {
                    console.log(ex);
                }
            }
          });

          this.projectsAsDict = {};

          this.projects.forEach(p => {
            if (typeof(p.name) == 'string' && p.name.length > 0) {
                this.projectsAsDict[p.name] = p;
            }
          });
    }

    static globalInstance = null;

    static initGlobalInstance(directory) {
        ProjectManager.globalInstance = new ProjectManager(directory);
    }

    getProjectByName(name) {
        return this.projectsAsDict[name];
    }

    addProject(dbName) {
        try {
            let p = new Project(this.directory + "/" + dbName);
            this.projects.push(p);
            this.projectsAsDict[p.name] = p;
            return p;
        } catch(ex) {
            console.log(ex);
        }

        return null;
    }

    removeProject(name) {
        let p = this.projectsAsDict[name];
        if (!p) {
            return false;
        }

        this.projects = this.projects.filter(item => item != p);
        Project.destroy(p);
        delete this.projectsAsDict[name];
        return true;
    }
};

module.exports = ProjectManager;
