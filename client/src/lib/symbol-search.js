
import { fuzzyMatch, fuzzyMatchMulti, sublimeScore } from './fuzzy-match.js';

import $ from 'jquery'

class ArrayRange {
    beginIndex = 0;
    endIndex = 0;

    constructor(begin = 0, end = 0) {
        this.beginIndex = begin;
        this.endIndex = end;
    }

    get length() {
        return this.endIndex - this.beginIndex;
    }
}

class SymbolDatasetEntry {
    id;
    name;
    parentIndex;

    constructor(id, name, parentIdx = null) {
        this.id = id;
        this.name = name;
        this.parentIndex = parentIdx;
    }
}

class SymbolDataset {
    entries = [];
    ranges = {};
    #parentIndexMap = new Map();
    #qualifiedNameMap = new Map();

    constructor() {
        this.clear();
    }

    clear() {
        this.#parentIndexMap.clear();
        this.#qualifiedNameMap.clear();
        this.ranges = {};
        this.entries = [];
        // we push a "null" entry so that index zero isn't used as "parentIndex".
        // that way we can write !entry.parentIndex instead of entry.parentIndex != null.
        this.entries.push(new SymbolDatasetEntry(0, ""));
    }

    has(kind) {
        return this.ranges[kind] != null;
    }

    at(i) {
        return this.entries[i];
    }

    incorporate(symbols) {
        for (const kind in symbols) {
            if (this.ranges[kind]) { // we already have the data for this
                continue;
            }

            const can_be_parent = this.#canBeParent(kind);

            const columns = symbols[kind];

            const ids = columns['id'];
            const names = columns['name'];
            const parents = columns['parent'];

            const size = ids.length;
            let range = new ArrayRange(this.entries.length, this.entries.length + ids.length);

            for (let i = 0; i < size; ++i) {
                let parent_index = parents[i] ? this.#findParentIndex(parents[i]) : null;
                if (can_be_parent) {
                    this.#registerPotentialParent(ids[i]); // must be called before entries.push()
                }
                this.entries.push(new SymbolDatasetEntry(ids[i], names[i], parent_index));
            }

            this.ranges[kind] = range;
        }
    } 

    getQualifiedName(entryIndex, cacheResult = false) {
        let qname = this.#qualifiedNameMap.get(entryIndex);

        if (qname) {
            return qname;
        }

        let r = null;

        if (this.entries[entryIndex].parentIndex) {
            r = this.getQualifiedName(this.entries[entryIndex].parentIndex, true);
            r = r.concat(this.entries[entryIndex].name);
        } else {
            r = [this.entries[entryIndex].name];
        }

        if (cacheResult) {
            this.#qualifiedNameMap.set(entryIndex, r);
        }

        return r;
    }

    #canBeParent(kind) {
        return kind == 'namespace' || kind == 'class' || kind == 'struct' || kind == 'enum';
    }

    #registerPotentialParent(symbolId) {
        this.#parentIndexMap.set(symbolId, this.entries.length);
    }

    #findParentIndex(parentId) {
        return this.#parentIndexMap.get(parentId);
    }
}


export class SymbolSearchEngine {
    projectInfo = null;
    symbolDataset = null;
    inputText = "";
    searchResults = [];
    maxResults = 32;
    onstep = null;
    oncomplete = null;
    state = 'idle';
    #batchSize = 100;
    #stepDuration = 5;
    #timer = null;
    #rangesToCheck = [];
    #currentRangeIndex = 0;
    #currentIndexInRange = 0;
    #fetchingData = false;

    constructor(projectInfo) {
        this.projectInfo = projectInfo;
        this.symbolDataset = new SymbolDataset();
    }

    parseQuery(text) {
        if (text.length == 0) {
            return null;
        }

        let parts = text.split("::");

        if (text.endsWith("::")) {
            return {
                name: null,
                qualifiedName: parts 
            };
        } else {
            return {
                name: parts[parts.length - 1],
                qualifiedName: parts 
            };
        }
        
    }

    setSearchText(text) {
        this.inputText = text;

        this.query = this.parseQuery(text);

        this.searchResults = [];
        this.#currentRangeIndex = 0;
        this.#currentIndexInRange = 0;

        if (text == "") {
            this.#rangesToCheck = [];
            this.state = 'idle';
        } else {
            this.state = 'running';
            this.#rangesToCheck = ['function', 'class', 'struct', 'union', 'enum', 'enum-constant'];
            if (this.#fetchingData) {
                this.#scheduleStep();
            } else {
                this.fetchData();
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
        let total = this.#rangesToCheck.reduce((acc, item) => {
            let range = this.symbolDataset.ranges[item];
            if (range) {
                return range.length + acc;
            } else {
                return acc;
            }
        }, 0);

        let done = 0;

        for (let i = 0; i < this.#currentRangeIndex; ++i) {
            let range = this.symbolDataset.ranges[this.#rangesToCheck[i]];
            if (range) {
                return range.length + done;
            } 
        }

        return (this.#currentIndexInRange + done) / Math.max(total, 1);
    }

    #fetchTier1() {
        let url = `/api/snapshots/${this.projectInfo.projectName}/${this.projectInfo.projectRevision}/symbols/dict?kind=namespace,class`;
        $.get(url, data => {
            if (data.success) {
                this.symbolDataset.incorporate({
                    namespace: data.dict.namespace
                });

                this.symbolDataset.incorporate({
                    class: data.dict.class
                });

                if (this.running && this.#timer == null) {
                    this.#step();
                }

                this.#fetchTier2();
            } else {
                if (this.running) {
                    // TODO: cancel search
                }
            }
        });
    }

    #fetchTier2() {
        let url = `/api/snapshots/${this.projectInfo.projectName}/${this.projectInfo.projectRevision}/symbols/dict?function,instance-method,static-method,class-method`;
        $.get(url, data => {
            if (data.success) {
                this.symbolDataset.incorporate(data.dict);
                if (this.running && this.#timer == null) {
                    this.#step();
                }

                this.#fetchTier3();
            }else {
                if (this.running) {
                    // TODO: cancel search
                }
            }
        });
    }

    #fetchTier3() {
        let url = `/api/snapshots/${this.projectInfo.projectName}/${this.projectInfo.projectRevision}/symbols/dict?enum,enum-constant`;
        $.get(url, data => {
            if (data.success) {
                this.symbolDataset.incorporate(data.dict);
                if (this.running && this.#timer == null) {
                    this.#step();
                }
            } else {
                if (this.running) {
                    // TODO: cancel search
                }
            }
        });
    }

    fetchData() {
        this.#fetchingData = true;
        this.#fetchTier1();
    }

    #scheduleStep() {
        if (!this.#timer) {
            this.#timer = setTimeout(() => this.#step());
        }
    }

    #matchDatasetItem(kind, element, idx) {
        if (!element.parentIndex && (this.query.qualifiedName.length > 1)) {
            return null;
        }

        if (this.query.qualifiedName.length == 1) {
            if (this.query.name) {
                let m = fuzzyMatch(element.name, this.query.name, sublimeScore);
                if (!m) {
                    return null;
                }

                let symbol = {
                    kind: kind,
                    id: element.id,
                    name: element.name
                };

                if (element.parentIndex) {
                    symbol.qualifiedName = this.symbolDataset.getQualifiedName(idx).join("::");
                }

                return {
                    score: m.score,
                    match: m.match,
                    symbol: symbol
                };
            } else {
                return null;
            }
        } else {
            let qname = this.symbolDataset.getQualifiedName(idx);
            let m = fuzzyMatchMulti(qname, this.query.qualifiedName, {
                mustMatchFinalPart: this.query.name != null,
                partSeparatorLength: 2
            });

            if (!m) {
                return null;
            }

            let symbol = {
                kind: kind,
                id: element.id,
                name: element.name
            };

            if (element.parentIndex) {
                symbol.qualifiedName = this.symbolDataset.getQualifiedName(idx).join("::");
            }

            return {
                score: m.score,
                match: m.match,
                symbol: symbol
            };
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
            if (best_score < this.searchResults[this.searchResults.length - 1]) {
                return false;
            }
        }

        for (const m of matches) {
            this.searchResults.push(m);
        }

        this.searchResults.sort((a,b) => b.score - a.score);

        if (this.searchResults.length > this.maxResults) {
            this.searchResults.splice(this.searchResults.length, this.searchResults.length - this.maxResults);
        }

        return true;
    }
    
    #step() {
        this.#timer = null;

        const current_range_name = this.#rangesToCheck[this.#currentRangeIndex];

        if (!this.symbolDataset.ranges[current_range_name]) { // dataset not available yet...
            // wait for it!
            return;
        }

        let new_matches = [];
        let current_range = this.symbolDataset.ranges[this.#rangesToCheck[this.#currentRangeIndex]];

        let stop_time = performance.now() + this.stepDuration;
        do {
            let end_index =  Math.min(current_range.length, this.#currentIndexInRange + this.batchSize);
            for (let i = this.#currentIndexInRange; i < end_index; ++i) {
                let element = this.symbolDataset.at(i + current_range.beginIndex);
                let match = this.#matchDatasetItem(current_range_name, element, i + current_range.beginIndex);
                if (match) {
                    new_matches.push(match);
                }
            }
            this.#currentIndexInRange = end_index;
        } while(this.#currentIndexInRange < current_range.length && performance.now() < stop_time);

        const result_changed = this.#integrateNewMatchesIntoSearchResults(new_matches);
        if (this.onstep) {
            this.onstep(result_changed);
        }

        if (this.#currentIndexInRange == current_range.length) {
            this.#currentRangeIndex += 1;
            this.#currentIndexInRange = 0;
            if (this.#currentRangeIndex == this.#rangesToCheck.length) {
                // we are actually finished
                this.state = 'finished';
                if (this.oncomplete) {
                    this.oncomplete();
                }
            } else {
                this.#scheduleStep();
            }
        } else { // unfinished work on this range
            this.#scheduleStep();
        }
    }
}
