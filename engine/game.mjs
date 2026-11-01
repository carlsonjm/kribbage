// One game of two-handed Cribbage, start to finish. The state is a plain
// object the screen reads; every change goes through the functions below,
// which refuse illegal moves and record what happened as events the screen
// can animate (a card laid, points pegged, the count going back to zero).
//
// Players are 0 (the person) and 1 (the computer). Nothing here knows which
// is which: the computer's choices live in ai.mjs.

import { newDeck, shuffle, rng, value, sameCard, without } from './cards.mjs';
import { scoreHand, scorePlay, pileCount } from './score.mjs';

export const TARGET = 121;
export const SKUNK = 91;
export const DOUBLE_SKUNK = 61;

export function newGame({ seed = Date.now(), dealer = null, manualCut = false } = {}) {
  const random = rng(seed);
  const state = {
    seed,
    random,
    manualCut,
    dealer: dealer === null ? (random() < 0.5 ? 0 : 1) : dealer,
    scores: [0, 0],
    backPegs: [0, 0],
    handNumber: 0,
    phase: 'discard',
    hands: [[], []],
    kept: [[], []],
    crib: [],
    discarded: [false, false],
    deck: [],
    starter: null,
    pile: [],
    pastPiles: [],
    turn: null,
    goSaid: [false, false],
    showStep: 0,
    show: null,
    winner: null,
    events: []
  };
  deal(state);
  return state;
}

function emit(state, event) {
  state.events.push(event);
  return event;
}

// Takes the events since the screen last asked, so it can play them in order.
export function takeEvents(state) {
  const out = state.events;
  state.events = [];
  return out;
}

function deal(state) {
  state.handNumber++;
  state.deck = shuffle(newDeck(), state.random);
  state.hands = [[], []];
  const pone = 1 - state.dealer;
  for (let i = 0; i < 6; i++) {
    state.hands[pone].push(state.deck.pop());
    state.hands[state.dealer].push(state.deck.pop());
  }
  state.kept = [[], []];
  state.crib = [];
  state.discarded = [false, false];
  state.starter = null;
  state.pile = [];
  state.pastPiles = [];
  state.goSaid = [false, false];
  state.turn = null;
  state.show = null;
  state.showStep = 0;
  state.phase = 'discard';
  emit(state, { type: 'deal', dealer: state.dealer, hand: state.handNumber });
}

function addPoints(state, player, points, reason, lines = []) {
  if (points <= 0 || state.phase === 'over') return;
  state.backPegs[player] = state.scores[player];
  state.scores[player] = Math.min(TARGET, state.scores[player] + points);
  emit(state, { type: 'score', player, points, reason, lines, score: state.scores[player] });
  if (state.scores[player] >= TARGET) {
    state.winner = player;
    state.phase = 'over';
    const loser = state.scores[1 - player];
    state.skunk = loser < DOUBLE_SKUNK ? 2 : loser < SKUNK ? 1 : 0;
    emit(state, { type: 'over', winner: player, skunk: state.skunk });
  }
}

function fail(message) {
  throw new Error(message);
}

// Each player lays two cards in the dealer's crib.
export function discard(state, player, cards) {
  if (state.phase !== 'discard') fail('Not the time to discard');
  if (state.discarded[player]) fail('Already discarded');
  if (cards.length !== 2) fail('Discard exactly two cards');
  const hand = state.hands[player];
  if (!cards.every((c) => hand.some((h) => sameCard(h, c)))) fail('Card not in hand');
  if (sameCard(cards[0], cards[1])) fail('Two different cards');
  state.hands[player] = without(hand, cards);
  state.crib.push(...cards);
  state.discarded[player] = true;
  emit(state, { type: 'discard', player });
  if (state.discarded[0] && state.discarded[1]) cut(state);
}

function cut(state) {
  // The pone cuts and the dealer turns the top of the lower part: any card
  // left in the deck. With manualCut the screen chooses where (cutAt);
  // otherwise it falls at random.
  if (state.manualCut) {
    state.phase = 'cut';
    state.turn = 1 - state.dealer;
    emit(state, { type: 'cut', player: state.turn });
    return;
  }
  turnStarter(state, Math.floor(state.random() * state.deck.length));
}

// The cut lands at `index` in what is left of the deck.
export function cutAt(state, index) {
  if (state.phase !== 'cut') fail('Not the time to cut');
  if (!(index >= 0 && index < state.deck.length)) fail('No card there');
  turnStarter(state, Math.floor(index));
}

function turnStarter(state, index) {
  state.starter = state.deck.splice(index, 1)[0];
  state.kept = [state.hands[0].slice(), state.hands[1].slice()];
  emit(state, { type: 'starter', card: state.starter });
  state.phase = 'play';
  if (state.starter.rank === 11) {
    addPoints(state, state.dealer, 2, 'his heels', [{ kind: 'his heels', cards: [state.starter], points: 2 }]);
  }
  state.turn = 1 - state.dealer;
}

export function count(state) {
  return pileCount(state.pile);
}

export function playable(state, player) {
  if (state.phase !== 'play') return [];
  const room = 31 - count(state);
  return state.hands[player].filter((c) => value(c) <= room);
}

export function mustSayGo(state, player) {
  return state.phase === 'play' && state.turn === player
    && state.hands[player].length > 0 && playable(state, player).length === 0;
}

function out(state, player) {
  return state.goSaid[player] || state.hands[player].length === 0;
}

function resetCount(state, leader) {
  state.pastPiles.push(state.pile);
  state.pile = [];
  state.goSaid = [false, false];
  emit(state, { type: 'reset' });
  if (state.hands[0].length === 0 && state.hands[1].length === 0) {
    startShow(state);
    return;
  }
  state.turn = state.hands[leader].length ? leader : 1 - leader;
}

export function play(state, player, c) {
  if (state.phase !== 'play') fail('Not the time to play');
  if (state.turn !== player) fail('Not your turn');
  if (!state.hands[player].some((h) => sameCard(h, c))) fail('Card not in hand');
  if (count(state) + value(c) > 31) fail('That card would pass 31');

  state.hands[player] = without(state.hands[player], [c]);
  state.pile.push(c);
  emit(state, { type: 'play', player, card: c, count: count(state) });
  const scored = scorePlay(state.pile);
  addPoints(state, player, scored.total, 'play', scored.lines);
  if (state.phase === 'over') return;

  const other = 1 - player;
  const bothEmpty = state.hands[0].length === 0 && state.hands[1].length === 0;

  if (count(state) === 31) {
    resetCount(state, other);
    return;
  }
  if (bothEmpty) {
    addPoints(state, player, 1, 'last card', [{ kind: 'last card', cards: [c], points: 1 }]);
    if (state.phase === 'over') return;
    resetCount(state, other);
    return;
  }
  if (!out(state, other)) {
    state.turn = other;
    return;
  }
  // The other player is out for this count, so this player carries on.
  if (playable(state, player).length) {
    state.turn = player;
    return;
  }
  addPoints(state, player, 1, 'go', [{ kind: 'go', cards: [c], points: 1 }]);
  if (state.phase === 'over') return;
  resetCount(state, other);
}

export function sayGo(state, player) {
  if (!mustSayGo(state, player)) fail('Go is only for when no card fits');
  state.goSaid[player] = true;
  emit(state, { type: 'go', player });
  const other = 1 - player;
  if (state.hands[other].length && playable(state, other).length) {
    state.turn = other;
    return;
  }
  // Nobody can lay a card: whoever laid last pegs one for the go. When the
  // other player has no cards left they said nothing, so they laid last.
  addPoints(state, other, 1, 'go', [{ kind: 'go', cards: [], points: 1 }]);
  if (state.phase === 'over') return;
  resetCount(state, player);
}

const SHOW_ORDER = ['pone', 'dealer', 'crib'];

function startShow(state) {
  state.phase = 'show';
  state.turn = null;
  state.showStep = 0;
  countShowStep(state);
}

function countShowStep(state) {
  const step = SHOW_ORDER[state.showStep];
  const player = step === 'pone' ? 1 - state.dealer : state.dealer;
  const cards = step === 'crib' ? state.crib : state.kept[player];
  const result = scoreHand(cards, state.starter, step === 'crib');
  state.show = Object.assign({ step, player, cards, starter: state.starter }, result);
  emit(state, { type: 'show', step, player, total: result.total });
  addPoints(state, player, result.total, step === 'crib' ? 'crib' : 'hand', result.lines);
}

// Moves the show on: the dealer's hand, then the crib, then the next deal.
export function nextShow(state) {
  if (state.phase !== 'show') fail('Not counting');
  if (state.showStep < SHOW_ORDER.length - 1) {
    state.showStep++;
    countShowStep(state);
    return;
  }
  state.dealer = 1 - state.dealer;
  deal(state);
}
