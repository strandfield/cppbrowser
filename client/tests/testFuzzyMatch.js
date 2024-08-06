
import { fuzzyMatch, sublimeScore } from "../src/lib/fuzzy-match.js";

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
