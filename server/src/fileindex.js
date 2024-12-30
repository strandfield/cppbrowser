
const { ProjectRevision, ProjectVersion, Project } = require('./project.js');
const ProjectManager = require("./projectmanager.js");

class IndexEntry
{
  filePath; // string
  projectName; // string
  projectVersion; // latest revision in which the file appears (ProjectVersion)
}

class FileIndex
{
    #projectRevisions; // array
    #fileMap; // Map (key = "project:filepath", value=IndexEntry) 
    // TODO: add a sha1:filename -> IndexEntry map ?
    #projectManager = null; // used in rebuild()

    constructor() {
        this.#projectRevisions = [];
        this.#fileMap = new Map();
    }

    clear() {
        this.#projectRevisions = [];
        this.#fileMap.clear();
        this.#projectManager = null;
    }

    #collectFilesFromProjectRevision(rev) {
        if (!rev) {
            return;
        }

        this.#projectRevisions.push(rev);

        const project_name = rev.getProjectName();
        const project_version = rev.getVersionObject();

        let files = rev.getAllFilesInHomeFolder();
        
        for (const file of files)
        {
            const key = project_name + ":" + file.path;
            let entry = this.#fileMap.get(key);

            if (entry)
            {
                if (ProjectVersion.comp(entry.projectVersion, project_version) < 0) {
                    entry.projectVersion = project_version;
                }
            }
            else
            {
                entry = new IndexEntry();
                entry.filePath = rev.getPathRelativeToHome(file.path);
                entry.projectName = project_name;
                entry.projectVersion = project_version;
                this.#fileMap.set(key, entry);
            }
        }
    }

    #collectFilesFromProject(project) {
        if (project instanceof ProjectRevision) {
            this.#collectFilesFromProjectRevision(project);
            return;
        }

        for (const rev of project.revisions) {
            this.#collectFilesFromProjectRevision(rev);
        }
    }

    build(projectContainer) {
        if (Array.isArray(projectContainer)) {
            for (const pro of projectContainer) {
                this.#collectFilesFromProject(pro);
            }
        } else if (projectContainer instanceof ProjectManager) {
            this.#projectManager = projectContainer;
            for (const pro of projectContainer.getProjects()) {
                this.#collectFilesFromProject(pro);
            }
        } else if (projectContainer instanceof Project) {
            this.#collectFilesFromProject(projectContainer);
        } else if (projectContainer instanceof ProjectRevision) {
            this.#collectFilesFromProjectRevision(projectContainer);
        } else {
            console.log("bad project container");
            return;
        }
    }

    rebuild() {
        const project_manager = this.#projectManager;
        this.clear();
        this.build(project_manager);
    }

    getSource() {
        let snapshots = [...this.#projectRevisions];
        snapshots.sort((a,b) => {
            return a.projectName.localeCompare(b.projectName);
        });

        let result = [];
        let push_result = function(projectName, versions) {
            result.push({
                project: projectName,
                versions: versions
            });
        };

        if (snapshots.length > 0) {
            let project_name = snapshots[0].projectName;
            let versions = [];
            for (const snapshot of snapshots) {
                if (project_name != snapshot.projectName) {
                    push_result(project_name, versions);
                    project_name = snapshot.projectName;
                    versions = [];
                }

                versions.push(snapshot.name);
            }

            push_result(project_name, versions);
        }

        return result;
    }

    getSnapshot(projectName, projectRevision) {
        return this.#projectRevisions.find(e => {
            return e.projectName == projectName && e.name == projectRevision;
        });
    }

    getAllFilesAsArray() {
        let result = [];
        for (const entry of this.#fileMap.values()) {
            result.push(entry);
        }
        return result;
    }
};

module.exports = FileIndex;
