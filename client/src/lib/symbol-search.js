
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

            // TODO: need to register all parents first
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

export const symbolFilters = {
    'c': {
        description: "C++ classes",
        value: ['class', 'struct']
    },
    't': {
        description: "Types",
        value: ['class', 'struct', 'union', 'enum']
    },
    'm': {
        description: "Functions",
        value: ['function', 'method', 'static-method', 'class-method']
    },
    'e': {
        description: "Enums and enum constants",
        value: ['enum', 'enum-constant']
    }
};

export class SymbolSearchEngine {
    projectInfo = null;
    symbolDataset = null;
    inputText = "";
    searchResults = [];
    maxResults = 32;
    #filter = null;
    onstep = null;
    oncomplete = null;
    state = 'idle';
    #batchSize = 100;
    #stepDuration = 5;
    #timer = null;
    #defaultRangesToCheck = ['function', 'method', 'static-method', 'class-method', 'class', 'struct', 'union', 'enum', 'enum-constant'];
    #rangesToCheck = [];
    #currentRangeIndex = 0;
    #currentIndexInRange = 0;
    #fetchingData = false;
    #extraSearchResults = [];

    constructor(projectInfo = null) {
        this.projectInfo = projectInfo;
        this.symbolDataset = new SymbolDataset();
        this.#rangesToCheck = this.#defaultRangesToCheck;
    }

    static isSame(a, b) {
        if ((a == null && b == null) || ((a == null) != (b == null))) {
            return true;
        }

        return a.projectName == b.projectName && a.projectRevision == b.projectRevision;
    }

    reconfigure(projectInfo) {
        if (SymbolSearchEngine.isSame(this.projectInfo, projectInfo)) {
            return;
        }

        this.projectInfo = projectInfo;
        this.symbolDataset.clear();

        this.searchResults = [];
        this.#extraSearchResults = [];
        this.#currentIndexInRange = 0;
        this.#currentRangeIndex = 0;

        if (this.running) {
            this.fetchData();
        }
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
        if (this.inputText == text) {
            return;
        }

        const previous_input_text = this.inputText;
        this.inputText = text;

        this.query = this.parseQuery(text);

        if (text == "") {
            this.#currentRangeIndex = 0;
            this.#currentIndexInRange = 0;
            this.searchResults = [];
            this.#extraSearchResults = [];
            this.state = 'idle';
        } else {
            // if we have just added characters to the search text, 
            // symbols that did not match still won't match so there is
            // no need to reprocess them.
            const results_remain_valid = text.startsWith(previous_input_text);
            if (!results_remain_valid) {
                this.#currentRangeIndex = 0;
                this.#currentIndexInRange = 0;
            }
            this.#rerankSearchResults(!results_remain_valid);

            if (this.#currentRangeIndex == this.#rangesToCheck.length) {
                this.state = 'finished';
                if (this.oncomplete) {
                    this.oncomplete();
                }
            } else {
                this.state = 'running';
                if (this.#fetchingData) {
                    this.#scheduleStep();
                } else {
                    this.fetchData();
                }
            }
        }
    }

    get filter() {
        return this.#filter;
    }

    set filter(f) {
        if (f == this.#filter) {
            return;
        }

        let ranges = [];

        if (f == null) {
            ranges = this.#defaultRangesToCheck;
        } else if (Array.isArray(f)) {
            ranges = f;
        } else if (symbolFilters[f]) {
            ranges = symbolFilters[f].value;
        } else {
            console.error(`bad filter ${f}`);
            return;
        }

        this.#filter = f;
        this.#rangesToCheck = ranges;

        if (this.state == 'idle') {
            return;
        }

        this.#currentRangeIndex = 0;
        this.#currentIndexInRange = 0;
        this.searchResults = [];
        this.#extraSearchResults = [];

        if (this.#currentRangeIndex == this.#rangesToCheck.length) {
            this.state = 'finished';
            if (this.oncomplete) {
                this.oncomplete();
            }
        } else {
            this.state = 'running';
            if (this.#fetchingData) {
                this.#scheduleStep();
            } else {
                this.fetchData();
            }
        }
    }

    clearFilter() {
        this.filter = null;
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
                done = range.length + done;
            } 
        }

        return (this.#currentIndexInRange + done) / Math.max(total, 1);
    }

    #getFetchUrl(filters) {
        if (this.projectInfo) {
            return `/api/snapshots/${this.projectInfo.projectName}/${this.projectInfo.projectRevision}/symbols/dict?kind=${filters.join(",")}`;
        } else {
            return `/api/symbols/dict?kind=${filters.join(",")}`;
        }
    }

    #fetchTier1() {
        const url = this.#getFetchUrl(['namespace', 'class', 'struct', 'union']);
        $.get(url, data => {
            if (data.success) {
                if (!SymbolSearchEngine.isSame(data.params, this.projectInfo)) {
                    return;
                }

                // it is important that namespaces are processed first as they cannot be anyone else child
                this.symbolDataset.incorporate({
                    namespace: data.dict.namespace
                });

                this.symbolDataset.incorporate({
                    class: data.dict.class
                });

                this.symbolDataset.incorporate({
                    struct: data.dict.struct,
                    union: data.dict.union
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
        const url = this.#getFetchUrl(['function', 'method', 'static-method', 'class-method']);
        $.get(url, data => {
            if (data.success) {
                if (!SymbolSearchEngine.isSame(data.params, this.projectInfo)) {
                    return;
                }

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
        const url = this.#getFetchUrl(['enum', 'enum-constant']);
        $.get(url, data => {
            if (data.success) {
                if (!SymbolSearchEngine.isSame(data.params, this.projectInfo)) {
                    return;
                }

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
                    name: element.name,
                };

                if (element.parentIndex) {
                    symbol.qualifiedName = this.symbolDataset.getQualifiedName(idx).join("::");
                }

                return {
                    score: m.score,
                    match: m.match,
                    index: idx,
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
                index: idx,
                symbol: symbol
            };
        }
    }

    // Called when the search input text has changed to check if the results are still
    // matching, and if so, to rerank them.
    #rerankSearchResults(outdated = true) {
        
        if (!this.searchResults.length) {
            return;
        }

        if (outdated || !this.#extraSearchResults.length) {
            this.#extraSearchResults = [];

            for (let i = 0; i < this.searchResults.length; ) {
                let r = this.searchResults[i];
                
                let m = this.#matchDatasetItem(r.symbol.kind, this.symbolDataset.at(r.index), r.index);
    
                if (!m) {
                    this.searchResults.splice(i, 1);
                    continue;
                }
    
                // update match and score
                r.score = m.score;
                r.match = m.match;
    
                // possibly mark the result as outdated though, so that it may be removed
                // when the element is matched again
                r.outdated = r.outdated || outdated;
                
                ++i; // go on to the next item
            }
    
            this.searchResults.sort((a,b) => b.score - a.score);
        } else {
            let results = [];

            let process_items = (items) => {
                for (const r of items) {            
                    let m = this.#matchDatasetItem(r.symbol.kind, this.symbolDataset.at(r.index), r.index);
        
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
