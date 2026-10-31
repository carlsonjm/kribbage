// The Fate meter. Bad luck fills it: thin hands of your own, big hands and
// big pegging for the computer. When it is full the person can call on it at
// the cut, and the cut falls on the best card for their hand. Before it is
// full, the fuller it is, the likelier an ordinary cut leans their way.
//
// The meter is its own small object beside the game, so the rules in
// game.mjs stay standard Cribbage and Fate can be switched off entirely.
// Only the person (seat 0) has a meter.

import { handTotal } from './score.mjs';

export const FULL = 100;
export const TRICKLE = 20;

export function newFate({ on = true } = {}) {
  return { on, level: 0 };
}

export function isFull(fate) {
  return fate.on && fate.level >= FULL;
}

export function setOn(fate, on) {
  fate.on = on;
  if (!on) fate.level = 0;
}

function add(fate, points) {
  if (!fate.on || points <= 0) return 0;
  const before = fate.level;
  fate.level = Math.max(0, Math.min(FULL, fate.level + points));
  return fate.level - before;
}

// Feeds one game event to the meter. Returns how much it rose, so the
// screen can show the bar filling.
export function noteEvent(fate, event) {
  // Every deal after the first adds a little, so the meter comes round two
  // or three times a game even when luck is even.
  if (event.type === 'deal') return event.hand > 1 ? add(fate, TRICKLE) : 0;
  if (event.type === 'show') {
    if (event.player === 0) {
      const thin = event.total <= 2 ? 45 : event.total < 6 ? 30 : event.total < 8 ? 12 : 0;
      // A crib is often thin; only a really poor one counts against luck.
      if (event.step !== 'crib' || event.total < 4) return add(fate, thin);
      return 0;
    }
    if (event.total >= 10) return add(fate, 20);
    return 0;
  }
  if (event.type === 'score' && event.player === 1 && event.reason === 'play' && event.points >= 4) {
    return add(fate, 10);
  }
  return 0;
}

// Every card left in the deck, best first for the person: their kept hand
// with it, plus half the crib's value with it when the crib is theirs.
export function rankCuts(state) {
  const keep = state.hands[0];
  const ownCrib = state.dealer === 0;
  return state.deck
    .map((c, index) => ({
      index,
      worth: handTotal(keep, c) + (ownCrib ? handTotal(state.crib, c, true) * 0.5 : 0)
    }))
    .sort((a, b) => b.worth - a.worth);
}

// Where the cut falls, as an index into what is left of the deck, for
// game.cutAt. `call` is true when the person called on a full meter.
// Returns { index, fated }; fated means Fate chose the card.
export function chooseCut(fate, state, call, random) {
  const plain = { index: Math.floor(random() * state.deck.length), fated: false };
  if (!fate.on || state.hands[0].length !== 4) return plain;
  if (call) {
    if (!isFull(fate)) return plain;
    fate.level = 0;
    return { index: rankCuts(state)[0].index, fated: true };
  }
  if (fate.level >= FULL || random() >= fate.level / 400) return plain;
  const ranked = rankCuts(state);
  fate.level = fate.level * 0.5;
  return { index: ranked[Math.floor(random() * Math.min(5, ranked.length))].index, fated: true };
}
