
import { fuzzyMatchFilePath } from './fuzzy-match.js';

export class FileSearchEngine {
    #dataset = [];
    inputText = "";
    searchResults = [];
    maxResults = 32;
    onstep = null;
    oncomplete = null;
    state = 'idle';
    #batchSize = 100;
    #stepDuration = 5;
    #timer = null;
    #currentSearchIndex = 0;
    #extraSearchResults = [];
    #nextMatchId = 0;

    constructor(dataset = []) {
        this.#dataset = dataset;
    }

    get dataset() {
        return this.#dataset;
    }

    reset(files, inputText = null) {
        if (this.#dataset == files) {
            return;
        }

        this.#dataset = files;

        this.searchResults = [];
        this.#extraSearchResults = [];
        this.#currentSearchIndex = 0;
        this.#nextMatchId = 0;

        if (inputText != null) {
            this.setSearchText(inputText);
        } else {
            if (this.running) {
                this.fetchData();
            }
        }
    }

    parseQuery(text) {
        if (text.length == 0) {
            return null;
        }

        let path = text.replace("\\", "/");
        let parts = path.split("/");
        return {
            path: path,
            pathParts: parts,
        };
    }

    setSearchText(text) {
        if (this.inputText == text) {
            return;
        }

        const previous_input_text = this.inputText;
        this.inputText = text;

        this.query = this.parseQuery(text);

        if (text == "") {
            this.#currentSearchIndex = 0;
            this.#nextMatchId = 0;
            this.searchResults = [];
            this.#extraSearchResults = [];
            this.state = 'idle';
        } else {
            // if we have just added characters to the search text, 
            // symbols that did not match still won't match so there is
            // no need to reprocess them.
            const results_remain_valid = text.startsWith(previous_input_text);
            if (!results_remain_valid) {
                this.#currentSearchIndex = 0;
            }
            this.#rerankSearchResults(!results_remain_valid);

            if (this.#currentSearchIndex == this.#dataset.length) {
                this.state = 'finished';
                if (this.oncomplete) {
                    this.oncomplete();
                }
            } else {
                this.state = 'running';
                this.#scheduleStep();
            }
        }
    }

    get batchSize() {
        return this.#batchSize;
    }

    set batchSize(size) {
        this.#batchSize = size;
    }

    get stepDuration() {
        return this.#stepDuration;
    }

    set stepDuration(msecs) {
        this.#stepDuration = msecs;
    }

    get running() {
        return this.state == 'running';
    }

    get finished() {
        return this.state == 'finished';
    }

    get progress() {
        return this.#currentSearchIndex / Math.max(this.#dataset.length, 1);
    }

    #scheduleStep() {
        if (!this.#timer) {
            this.#timer = setTimeout(() => this.#step());
        }
    }

    #matchDatasetItem(element, idx) {
        let m = fuzzyMatchFilePath(element, this.query.pathParts);

        if (!m) {
            return null;
        }

        return {
            element: element,
            match: m.match,
            score: m.score,
            index: idx,
            matchId: this.#nextMatchId++
        };
    }

    // Called when the search input text has changed to check if the results are still
    // matching, and if so, to rerank them.
    #rerankSearchResults(outdated = true) {
        if (!this.searchResults.length) {
            return;
        }

        if (outdated || !this.#extraSearchResults.length) {
            this.#extraSearchResults = [];

            for (let i = 0; i < this.searchResults.length;) {
                let r = this.searchResults[i];

                let m = this.#matchDatasetItem(r.element, r.index);

                if (!m) {
                    this.searchResults.splice(i, 1);
                    continue;
                }

                // update match and score
                r.score = m.score;
                r.match = m.match;
                r.matchId = m.matchId;

                // possibly mark the result as outdated though, so that it may be removed
                // when the element is matched again
                r.outdated = r.outdated || outdated;

                ++i; // go on to the next item
            }

            this.searchResults.sort((a, b) => b.score - a.score);
        } else {
            let results = [];

            let process_items = (items) => {
                for (const r of items) {            
                    let m = this.#matchDatasetItem(r.element, r.index);
        
                    if (!m) {
                        continue;
                    }
                        
                    r.score = m.score;
                    r.match = m.match;
                    results.push(r);
                }
            }
    
            process_items(this.searchResults);
            process_items(this.#extraSearchResults);
            
            this.searchResults = results.sort((a,b) => b.score - a.score);
            if (this.searchResults.length > this.maxResults) {
                this.#extraSearchResults = this.searchResults.splice(this.maxResults, this.searchResults.length - this.maxResults);
            } else {
                this.#extraSearchResults = [];
            }
        }
    }

    #removeOutdatedResults(firstIndex) {

        let find_next_outdated = (startIndex) => {
            while (startIndex < this.searchResults.length) {
                if (this.searchResults[startIndex].outdated) {
                    return startIndex;
                } else {
                    ++startIndex;
                }
            }
            return -1;
        };

        let i = find_next_outdated(firstIndex);

        while (i != -1) {

            let idx = this.searchResults[i].index;
            let s = this.searchResults[i].score;

            let j = i + 1;
            let removed = false;
            while (j < this.searchResults.length && this.searchResults[j].score == s) {
                if (this.searchResults[j].index == idx) {
                    this.searchResults.splice(i, 1);
                    removed = true;
                    break;
                } else {
                    ++j;
                }
            }

            if (!removed) {
                ++i;
            }

            i = find_next_outdated(i);
        }
    }

    #integrateNewMatchesIntoSearchResults(matches) {
        if (matches.length == 0) {
            return false;
        }

        if (this.searchResults.length == this.maxResults) {
            // result list is already full: check if we have better results
            // among "matches".
            let best_score = matches.reduce((acc, e) => Math.max(acc, e.score), -10000);
            if (best_score < this.searchResults[this.searchResults.length - 1].score) {
                return false;
            }
        }

        for (const m of matches) {
            this.searchResults.push(m);
        }

        this.searchResults.sort((a,b) => b.score - a.score);

        let outdated_index = this.searchResults.findIndex(e => e.outdated);
        if (outdated_index != -1) {
            this.#removeOutdatedResults(outdated_index);
        }

        if (this.searchResults.length > this.maxResults) {
            let extra = this.searchResults.splice(this.maxResults, this.searchResults.length - this.maxResults);
            this.#extraSearchResults = this.#extraSearchResults.concat(extra);
        }

        return true;
    }
    
    #step() {
        this.#timer = null;

        let new_matches = [];

        let stop_time = performance.now() + this.stepDuration;
        do {
            let end_index = Math.min(this.#dataset.length, this.#currentSearchIndex + this.batchSize);
            for (let i = this.#currentSearchIndex; i < end_index; ++i) {
                let element = this.#dataset.at(i);
                let match = this.#matchDatasetItem(element, i);
                if (match) {
                    new_matches.push(match);
                }
            }
            this.#currentSearchIndex = end_index;
        } while (this.#currentSearchIndex < this.#dataset.length && performance.now() < stop_time);

        const result_changed = this.#integrateNewMatchesIntoSearchResults(new_matches);
        if (this.onstep) {
            this.onstep(result_changed);
        }

        if (this.#currentSearchIndex == this.#dataset.length) {
            this.state = 'finished';
            if (this.oncomplete) {
                this.oncomplete();
            }
        } else {
            this.#scheduleStep();
        }
    }
}
