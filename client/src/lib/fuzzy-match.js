
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
        return false;
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
        const recursion_count = 0;
        return fuzzyMatchRecursive(str, pattern, scoreFunc, 0, [], recursion_count, maxRecursion);
    }
}
