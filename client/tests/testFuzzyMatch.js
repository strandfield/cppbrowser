
import { fuzzyMatch, sublimeScore, AsyncFuzzyTextMatcher } from "../src/lib/fuzzy-match.js";

console.assert(fuzzyMatch("abcde", "ace"));
console.assert(fuzzyMatch("abcde", "abe"));
console.assert(fuzzyMatch("abcde", "abde"));
console.assert(fuzzyMatch("abcde", "bde"));
console.assert(!fuzzyMatch("abcde", "adb"));
console.assert(!fuzzyMatch("abcde", "abcdef"));
console.assert(!fuzzyMatch("abcde", "a1ce"));

let match = fuzzyMatch("abcde", "ace", sublimeScore);
console.assert(match);
console.assert(match.match.length == 3);
console.assert(match.match[0] == 0);
console.assert(match.match[1] == 2);
console.assert(match.match[2] == 4);

match = fuzzyMatch("abcde", "ace", sublimeScore);
console.assert(match);
console.assert(match.match.length == 3);
console.assert(match.match[0] == 0);
console.assert(match.match[1] == 2);
console.assert(match.match[2] == 4);

// first match (with the first 'a') is not the best because
// there is a bonus for adjacent letters
match = fuzzyMatch("nnnadace..", "ace", sublimeScore);
console.assert(match);
console.assert(match.match.length == 3);
console.assert(match.match[0] == 5);
console.assert(match.match[1] == 6);
console.assert(match.match[2] == 7);
// but if we forbid recursion, it becomes the "best" match
let m2 = fuzzyMatch("nnnadace..", "ace", sublimeScore, 0);
console.assert(m2);
console.assert(m2.match.length == 3);
console.assert(m2.match[0] == 3);
console.assert(m2.match[1] == 6);
console.assert(m2.match[2] == 7); 

let dataset = [
    "abcde",
    "a.c.e",
    "ac.e",
    "a..c..e",
    "8934",
    "4657",
    "ace"
    ];
let async_matcher = new AsyncFuzzyTextMatcher("ace");
async_matcher.batchSize = 2;
async_matcher.stepDuration = 0;
async_matcher.onstep = (n)=>{
    console.log(`Got ${n} new matche(s)`);
};
async_matcher.oncomplete = () => {
    console.log(`Total number of matches is ${async_matcher.matches.length}`);
    console.assert(async_matcher.matches.length == 5);
}

async_matcher.start(dataset);
