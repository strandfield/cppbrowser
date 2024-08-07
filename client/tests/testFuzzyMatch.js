
import { fuzzyMatch, sublimeScore, AsyncFuzzyTextMatcher, fuzzyMatchFilePath } from "../src/lib/fuzzy-match.js";

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
let m1 = fuzzyMatch("nnnadace..", "ace", sublimeScore);
console.assert(m1);
console.assert(m1.match.length == 3);
console.assert(m1.match[0] == 5);
console.assert(m1.match[1] == 6);
console.assert(m1.match[2] == 7);
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

console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", ".txt"));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "ghi"));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "def"));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "df"));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "abc"));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "ab"));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "a/e"));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "a/e/i"));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "a/e/."));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "a/ghi"));
console.assert(fuzzyMatchFilePath("abc/def/ghi.txt", "e/txt"));
console.assert(!fuzzyMatchFilePath("abc/def/ghi.txt", "a/b"));
console.assert(!fuzzyMatchFilePath("abc/def/ghi.txt", "bd"));
console.assert(!fuzzyMatchFilePath("abc/def/ghi.txt", "fghi"));

// test that matching filename gives a bonus
m1 = fuzzyMatchFilePath("abc/def.txt", "abc");
m2 = fuzzyMatchFilePath("def/abc.txt", "abc");
console.assert(m1 && m2);
console.assert(m2.score > m1.score);
