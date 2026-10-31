// Counting: a hand or crib at the show, and each card laid in the play.
// Every score comes back as lines a person can read, the way the counting
// screen shows them: { kind, cards, points }.

import { value } from './cards.mjs';

function subsets(list, size, start = 0, picked = [], out = []) {
  if (picked.length === size) { out.push(picked.slice()); return out; }
  for (let i = start; i < list.length; i++) {
    picked.push(list[i]);
    subsets(list, size, i + 1, picked, out);
    picked.pop();
  }
  return out;
}

function isRun(group) {
  const ranks = group.map((c) => c.rank).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

// The show. `hand` is the four kept cards, `starter` the turned card.
// A crib only counts a flush when all five share a suit.
export function scoreHand(hand, starter, isCrib = false) {
  const all = starter ? hand.concat([starter]) : hand.slice();
  const lines = [];

  for (let size = 2; size <= all.length; size++) {
    for (const group of subsets(all, size)) {
      if (group.reduce((sum, c) => sum + value(c), 0) === 15) {
        lines.push({ kind: 'fifteen', cards: group, points: 2 });
      }
    }
  }

  for (const pair of subsets(all, 2)) {
    if (pair[0].rank === pair[1].rank) lines.push({ kind: 'pair', cards: pair, points: 2 });
  }

  // Only the longest runs count: a run of four is not also two runs of three.
  for (let size = all.length; size >= 3; size--) {
    const runs = subsets(all, size).filter(isRun);
    if (runs.length) {
      for (const run of runs) lines.push({ kind: 'run', cards: run, points: size });
      break;
    }
  }

  if (hand.length === 4 && hand.every((c) => c.suit === hand[0].suit)) {
    const withStarter = starter && starter.suit === hand[0].suit;
    if (withStarter) lines.push({ kind: 'flush', cards: all, points: 5 });
    else if (!isCrib) lines.push({ kind: 'flush', cards: hand.slice(), points: 4 });
  }

  if (starter) {
    const nob = hand.find((c) => c.rank === 11 && c.suit === starter.suit);
    if (nob) lines.push({ kind: 'nobs', cards: [nob, starter], points: 1 });
  }

  return { lines, total: lines.reduce((sum, l) => sum + l.points, 0) };
}

// The same total as scoreHand, without building lines. The computer calls
// this tens of thousands of times a hand, so it counts with plain numbers.
export function handTotal(hand, starter, isCrib = false) {
  const all = starter ? hand.concat([starter]) : hand;
  const n = all.length;
  const vals = all.map(value);
  let total = 0;

  for (let mask = 3; mask < (1 << n); mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += vals[i];
    if (sum === 15) total += 2;
  }

  const counts = new Array(15).fill(0);
  for (const c of all) counts[c.rank]++;
  for (let r = 1; r <= 13; r++) total += counts[r] * (counts[r] - 1);

  for (let r = 1; r <= 13; r++) {
    if (!counts[r] || counts[r - 1]) continue;
    let len = 0, ways = 1;
    while (r + len <= 13 && counts[r + len]) { ways *= counts[r + len]; len++; }
    if (len >= 3) total += len * ways;
  }

  if (hand.length === 4 && hand.every((c) => c.suit === hand[0].suit)) {
    if (starter && starter.suit === hand[0].suit) total += 5;
    else if (!isCrib) total += 4;
  }
  if (starter && hand.some((c) => c.rank === 11 && c.suit === starter.suit)) total += 1;
  return total;
}

export function pileCount(pile) {
  return pile.reduce((sum, c) => sum + value(c), 0);
}

// The play. `pile` is every card laid since the count last went back to
// zero, the newest last. Scores what the newest card earned.
export function scorePlay(pile) {
  const lines = [];
  const count = pileCount(pile);
  const last = pile[pile.length - 1];
  if (!last) return { lines, total: 0 };

  if (count === 15) lines.push({ kind: 'fifteen', cards: pile.slice(), points: 2 });
  if (count === 31) lines.push({ kind: 'thirty-one', cards: pile.slice(), points: 2 });

  let same = 1;
  while (same < pile.length && pile[pile.length - 1 - same].rank === last.rank) same++;
  if (same >= 2) {
    const kinds = { 2: ['pair', 2], 3: ['three of a kind', 6], 4: ['four of a kind', 12] };
    const [kind, points] = kinds[same];
    lines.push({ kind, cards: pile.slice(-same), points });
  }

  for (let size = pile.length; size >= 3; size--) {
    const tail = pile.slice(-size);
    if (new Set(tail.map((c) => c.rank)).size === size && isRun(tail)) {
      lines.push({ kind: 'run', cards: tail, points: size });
      break;
    }
  }

  return { lines, total: lines.reduce((sum, l) => sum + l.points, 0) };
}
