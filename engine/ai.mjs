// The computer player, at three strengths:
//   easy   - a casual player: often keeps the wrong cards and lays
//            whatever comes to hand
//   steady - a decent club player who weighs every possible starter but
//            now and then keeps or lays the second-best card
//   sharp  - never slips, and also weighs what the crib is worth
// Easy and Steady make human mistakes on purpose, at the rates below, so
// their hands and pegging land where real players' do.
// It sees only what a person in its seat would: its own hand, the starter,
// and the cards already laid.

import { newDeck, value, without } from './cards.mjs';
import { handTotal, scorePlay, pileCount } from './score.mjs';
import { playable } from './game.mjs';

export const LEVELS = ['easy', 'steady', 'sharp'];

// How often each level slips: tosses a careless pair of cards, or lays a
// card without thinking it through.
const SLIPS = {
  easy: { discard: 0.6, play: 0.6 },
  steady: { discard: 0.3, play: 0.25 },
  sharp: { discard: 0, play: 0 }
};

function pairs(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  }
  return out;
}

// What two cards are likely to bring a crib, from the cards alone. Fives,
// pairs, fifteens and near-runs make a crib; wide gaps kill it.
function cribLean(a, b) {
  let lean = 4.2;
  if (a.rank === b.rank) lean += 2.3;
  if (value(a) + value(b) === 15) lean += 1.8;
  if (a.rank === 5) lean += 1.2;
  if (b.rank === 5) lean += 1.2;
  const gap = Math.abs(a.rank - b.rank);
  if (gap === 1) lean += 0.8;
  else if (gap === 2) lean += 0.4;
  else if (gap > 4 && a.rank !== b.rank) lean -= 0.5;
  if (a.rank === 11 || b.rank === 11) lean += 0.25;
  return lean;
}

export function chooseDiscard(hand, isDealer, level = 'steady', random = Math.random) {
  const unseen = without(newDeck(), hand);
  let best = null;
  const options = [];
  for (const toss of pairs(hand)) {
    const keep = without(hand, toss);
    let worth;
    if (level === 'easy') {
      worth = handTotal(keep, null);
    } else {
      let sum = 0;
      for (const s of unseen) sum += handTotal(keep, s);
      worth = sum / unseen.length;
      if (level === 'sharp') worth += (isDealer ? 1 : -1) * cribLean(toss[0], toss[1]);
    }
    options.push({ toss, worth });
    if (!best || worth > best.worth) best = { toss, worth };
  }
  const slip = (SLIPS[level] || SLIPS.steady).discard;
  if (random() < slip) {
    // Easy tosses any two; Steady keeps one of its next few best.
    options.sort((a, b) => b.worth - a.worth);
    const pool = level === 'easy' ? options.length : 4;
    return options[1 + Math.floor(random() * (pool - 1))].toss;
  }
  return best.toss;
}

// Chooses a card for the play, or null when it has to say go.
export function choosePlay(state, player, level = 'steady', random = Math.random) {
  const legal = playable(state, player);
  if (!legal.length) return null;
  if (random() < (SLIPS[level] || SLIPS.steady).play) return legal[Math.floor(random() * legal.length)];

  const hand = state.hands[player];
  let best = null;
  for (const c of legal) {
    const pile = state.pile.concat([c]);
    const now = pileCount(pile);
    let worth = scorePlay(pile).total;
    if (level !== 'easy') {
      // Leaving 5 or 21 hands the other player an easy fifteen or 31.
      if (now === 5 || now === 21) worth -= 1.6;
      if (state.pile.length === 0) {
        // Lead under five when possible: nothing then makes fifteen.
        if (value(c) < 5) worth += 0.8;
        if (c.rank === 5) worth -= 1.2;
      }
      // Save low cards for squeezing in near 31.
      worth += value(c) * 0.05;
      if (level === 'sharp') {
        // Holding a card that answers theirs: lay the one that sets up a
        // pair royal or a fifteen from what is still in hand.
        const rest = without(hand, [c]);
        if (rest.some((r) => r.rank === c.rank) && now + 2 * value(c) <= 31) worth += 0.6;
        if (rest.some((r) => now + value(r) === 31)) worth += 0.3;
        // Within one rank of the last card invites a run.
        const last = state.pile[state.pile.length - 1];
        if (last && Math.abs(last.rank - c.rank) === 1) worth -= 0.4;
        if (last && Math.abs(last.rank - c.rank) === 2) worth -= 0.3;
      }
    }
    if (!best || worth > best.worth) best = { card: c, worth };
  }
  return best.card;
}
