
// Inspired by fuzzyMatchRecursive() by Forrest Smith.
// Reference:
// https://github.com/forrestthewoods/lib_fts/blob/master/code/fts_fuzzy_match.js
// https://www.forrestthewoods.com/blog/reverse_engineering_sublime_texts_fuzzy_match/

const SEQUENTIAL_BONUS = 15; // bonus for adjacent matches
const SEPARATOR_BONUS = 30; // bonus if match occurs after a separator
const CAMEL_BONUS = 30; // bonus if match is uppercase and prev is lower
const FIRST_LETTER_BONUS = 15; // bonus if the first letter is matched

const LEADING_LETTER_PENALTY = -5; // penalty applied for every letter in str before the first match
const MAX_LEADING_LETTER_PENALTY = -15; // maximum penalty for leading letters
const UNMATCHED_LETTER_PENALTY = -1;

function hasFuzzyMatch(str, pattern) {
    if (pattern.length == 0) {
        return true;
    }

    let index_in_pattern = 0;
    let char_in_pattern = pattern.charAt(index_in_pattern).toLowerCase();

    for (const letter of str) {
        if (letter.toLowerCase() == char_in_pattern) {
            ++index_in_pattern;
            char_in_pattern = pattern.charAt(index_in_pattern).toLowerCase();
            if (index_in_pattern == pattern.length) {
                return true;
            }
        }
    }

    return false;
}

export function sublimeScore(str, pattern, match) {
    let score = 100;

    // Apply leading letter penalty
    // (note that we use Math.max() because the values are negative)
    let penalty = Math.max(LEADING_LETTER_PENALTY * match[0], MAX_LEADING_LETTER_PENALTY);
    score += penalty;

    //Apply unmatched penalty
    const unmatched = str.length - pattern.length;
    score += UNMATCHED_LETTER_PENALTY * unmatched;

    // Apply ordering bonuses
    for (let i = 0; i < pattern.length; i++) {
        const index_in_str = match[i];

        if (i > 0) {
            const prev_index_in_str = match[i - 1];
            if (index_in_str == prev_index_in_str + 1) {
                score += SEQUENTIAL_BONUS;
            }
        }

        // Check for bonuses based on neighbor character value.
        if (index_in_str > 0) {
            // Camel case
            const neighbor = str[index_in_str - 1];
            const curr = str[index_in_str];
            if (neighbor !== neighbor.toUpperCase() && curr !== curr.toLowerCase()) {
                score += CAMEL_BONUS;
            }
            const is_neighbour_separator = neighbor == "_" || neighbor == " ";
            if (is_neighbour_separator) {
                score += SEPARATOR_BONUS;
            }
        } else {
            // First letter
            score += FIRST_LETTER_BONUS;
        }
    }

    return score;
}

function fuzzyMatchRecursive(
    str,
    pattern,
    scoreFunc,
    strCurrentIndex,
    partialMatch,
    recursionCount,
    maxRecursion
) {
    if (recursionCount > maxRecursion) {
        return null;
    }

    if (strCurrentIndex === str.length) {
        return null;
    }

    let current_pattern_char = pattern[partialMatch.length].toLowerCase();
    let recursive_match = null;
    let my_match = null;

    while (strCurrentIndex < str.length) {
        if (current_pattern_char !== str[strCurrentIndex].toLowerCase()) {
            ++strCurrentIndex;
            continue;
        }

        if (!my_match) {
            my_match = [...partialMatch];
        }

        const rec_match = fuzzyMatchRecursive(
            str,
            pattern,
            scoreFunc,
            strCurrentIndex + 1,
            my_match,
            recursionCount + 1,
            maxRecursion
        );

        if (rec_match) {
            if (!recursive_match || rec_match.score > recursive_match.score) {
                recursive_match = rec_match;
            }
        }

        my_match.push(strCurrentIndex);

        if (my_match.length == pattern.length) {
            break;
        }

        current_pattern_char = pattern[my_match.length].toLowerCase();
        ++strCurrentIndex;
    }

    const matched = my_match && my_match.length === pattern.length;

    if (!matched) {
        return null;
    }

    let score = scoreFunc(str, pattern, my_match);

    if (recursive_match && recursive_match.score > score) {
        return recursive_match;
    } else {
        return {
            match: my_match,
            score: score
        };
    }
}

export function fuzzyMatch(str, pattern, scoreFunc = null, maxRecursion = 10)
{
    if (!scoreFunc) {
        return hasFuzzyMatch(str, pattern);
    } else {
        if (pattern.length == 0) {
            return {
                score: 0,
                match: []
            };
        }
        const recursion_count = 0;
        return fuzzyMatchRecursive(str, pattern, scoreFunc, 0, [], recursion_count, maxRecursion);
    }
}

export class AsyncFuzzyMatcher {
    pattern;
    matchFunc;
    matches = [];
    dataset;
    #datasetIndex = 0;
    #timer = null;
    batchSize = 100;
    stepDuration = 5;
    onstep = null;
    oncomplete = null;
    
    constructor(pattern, matchFunc) {
        this.pattern = pattern;
        this.matchFunc = matchFunc;
    }

    start(dataset) {
        this.flush();
        this.dataset = dataset;
        this.#datasetIndex = 0;

        if (!this.#timer) {
            this.#timer = setTimeout(() => this.#step());
        }
    }

    get running() {
        return this.#timer != null;
    }

    get progress() {
        return this.dataset && this.dataset.length > 0 ? this.#datasetIndex / this.dataset.length : 1;
    }

    cancel() {
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
    }

    flush() {
        this.matches = [];
    }

    #step() {
        let nb_matches = this.matches.length;

        let stop_time = performance.now() + this.stepDuration;
        do {
            let end_index =  Math.min(this.dataset.length, this.#datasetIndex + this.batchSize);
            for (let i = this.#datasetIndex; i < end_index; ++i) {
                let element = this.dataset[i];
                let match = this.matchFunc(element, this.pattern);
                if (match) {
                    this.matches.push(match);
                }
            }
            this.#datasetIndex = end_index;
        } while(this.#datasetIndex < this.dataset.length && performance.now() < stop_time);

        if (this.onstep) {
            this.onstep(this.matches.length - nb_matches);
        }

        if (this.#datasetIndex == this.dataset.length) {
            this.#timer = null;
            if (this.oncomplete) {
                this.oncomplete();
            }
        } else {
            this.#timer = setTimeout(()=>this.#step());
        }
    }
}

export class AsyncFuzzyTextMatcher extends AsyncFuzzyMatcher {
    constructor(pattern) {
        super(pattern, (e, p) => {
            let m = fuzzyMatch(e, p, sublimeScore);
            return m ? {text: e, match: m.match, score: m.score} : null;
        });
    }
}

export function fuzzyMatchMulti(source, pattern, {
    scoreFunc = sublimeScore,
    maxRecursion = 10,
    mustMatchFinalPart = false,
    finalPartMatchBonus = 0,
    partSeparatorLength = 1
} = {}) {
    if (pattern.length > source.length) {
        return null;
    }

    let matches = [];
    {
        let current_pattern_index = pattern.length - 1;
        let current_path_index = source.length - 1;

        if (mustMatchFinalPart) {
            let m = fuzzyMatch(source[current_path_index], pattern[current_pattern_index], scoreFunc, maxRecursion);

            if (!m) {
                return null;
            }

            matches.push({
                pathIndex: current_path_index,
                match: m
            });

            if (matches.length == pattern.length) {
                current_path_index = 0; // trick for not entering the while loop
            }

            --current_pattern_index;
            --current_path_index;
        }

        while (current_path_index >= 0) {
            let m = fuzzyMatch(source[current_path_index], pattern[current_pattern_index], scoreFunc, maxRecursion);
    
            if (m) {
                matches.push({
                    pathIndex: current_path_index,
                    match: m
                });
    
                if (matches.length == pattern.length) {
                    break;
                } else {
                    --current_pattern_index;
                    --current_path_index;
                }
            }
            else {
                --current_path_index;
            }
        }
    }

    if (matches.length != pattern.length) {
        return null;
    }

    let score = 0;
    if (matches[0].pathIndex == source.length - 1) {
        score += finalPartMatchBonus;
    }
    matches.forEach(e => score += e.match.score);

    let indices = [];
    matches = matches.reverse();
    {
        let offset = 0;
        let current_path_index = 0;
        for (const m of matches) {
            while (current_path_index < m.pathIndex) {
                offset += source[current_path_index].length + partSeparatorLength; // don't forget the separator!
                ++current_path_index;
            }
            for (const idx of m.match.match) {
                indices.push(idx + offset);
            }
        }
    }

    return {
        match: indices,
        score: score
    };
}

const MATCHING_FILENAME_BONUS = 15; // bonus the filename is matched

export function fuzzyMatchFilePath(str, pattern, scoreFunc = sublimeScore, maxRecursion = 10) {
    if (!Array.isArray(pattern)) {
        console.assert(typeof pattern == 'string');
        pattern = pattern.split("/");
    }

    let input_path = str;
    if (!Array.isArray(input_path)) {
        console.assert(typeof str == 'string');
        input_path = str.split("/");
    }

    return fuzzyMatchMulti(input_path, pattern, {
        scoreFunc: scoreFunc,
        maxRecursion: maxRecursion,
        finalPartMatchBonus: MATCHING_FILENAME_BONUS,
        partSeparatorLength: 1
    });
}

export class AsyncFileMatcher extends AsyncFuzzyMatcher {
    constructor(pattern, dataset) {
        super(pattern.split("/"), ()=>{});
        this.inputText = pattern;
        this.dataset = dataset;
        this.matchFunc = (e, p) => {
            let m = fuzzyMatchFilePath(e, p);
            return m ? {element: e, match: m.match, score: m.score} : null;
        };
    }

    run() {
        this.start(this.dataset);
    }
}