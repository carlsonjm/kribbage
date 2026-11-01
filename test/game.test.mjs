import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, discard, play, sayGo, nextShow, count, mustSayGo, takeEvents, TARGET } from '../engine/game.mjs';
import { chooseDiscard, choosePlay } from '../engine/ai.mjs';
import { rng } from '../engine/cards.mjs';

// Plays a whole game between two computer players, checking the rules hold
// at every step. Returns the finished state.
function runGame(seed, levels) {
  const g = newGame({ seed });
  const random = rng(seed ^ 0x5eed);
  let steps = 0;
  while (g.phase !== 'over') {
    if (++steps > 5000) throw new Error('game did not finish, seed ' + seed);
    if (g.phase === 'discard') {
      for (const p of [0, 1]) {
        assert.equal(g.hands[p].length, 6);
        discard(g, p, chooseDiscard(g.hands[p], g.dealer === p, levels[p], random));
      }
      if (g.phase === 'over') break;
      assert.equal(g.crib.length, 4);
      assert.equal(g.kept[0].length, 4);
      assert.equal(g.kept[1].length, 4);
      assert.ok(g.starter);
      const seen = new Set([...g.kept[0], ...g.kept[1], ...g.crib, g.starter, ...g.deck].map((c) => c.id));
      assert.equal(seen.size, 52, 'every card accounted for');
    } else if (g.phase === 'play') {
      const p = g.turn;
      if (mustSayGo(g, p)) sayGo(g, p);
      else play(g, p, choosePlay(g, p, levels[p], random));
      assert.ok(count(g) <= 31);
    } else if (g.phase === 'show') {
      nextShow(g);
    }
    takeEvents(g);
    assert.ok(g.scores[0] <= TARGET && g.scores[1] <= TARGET);
  }
  assert.equal(g.scores[g.winner], TARGET);
  assert.ok(g.scores[1 - g.winner] < TARGET);
  return g;
}

test('two thousand games finish within the rules', () => {
  for (let seed = 1; seed <= 2000; seed++) runGame(seed, ['steady', 'steady']);
});

test('illegal moves are refused', () => {
  const g = newGame({ seed: 7, dealer: 0 });
  assert.throws(() => play(g, 1, g.hands[1][0]), /Not the time/);
  assert.throws(() => discard(g, 0, g.hands[0].slice(0, 3)), /exactly two/);
  assert.throws(() => discard(g, 0, [g.hands[1][0], g.hands[1][1]]), /not in hand/);
  discard(g, 0, g.hands[0].slice(0, 2));
  assert.throws(() => discard(g, 0, g.hands[0].slice(0, 2)), /Already/);
  discard(g, 1, g.hands[1].slice(0, 2));
  if (g.phase === 'play') {
    assert.equal(g.turn, 1, 'the player who did not deal leads');
    assert.throws(() => play(g, 0, g.hands[0][0]), /Not your turn/);
    assert.throws(() => sayGo(g, 1), /only for when no card fits/);
  }
});

test('the same seed deals the same game', () => {
  const a = newGame({ seed: 42 });
  const b = newGame({ seed: 42 });
  assert.deepEqual(a.hands, b.hands);
});

test('sharp beats easy more often than not', () => {
  let sharp = 0;
  const n = 400;
  for (let seed = 1; seed <= n; seed++) {
    const levels = seed % 2 ? ['sharp', 'easy'] : ['easy', 'sharp'];
    const g = runGame(10000 + seed, levels);
    if (levels[g.winner] === 'sharp') sharp++;
  }
  console.log('sharp won ' + sharp + ' of ' + n);
  assert.ok(sharp / n > 0.55);
});

import { cutAt } from '../engine/game.mjs';
test('a manual cut waits for the cutter, then turns that card', () => {
  const g = newGame({ seed: 3, dealer: 0, manualCut: true });
  discard(g, 0, g.hands[0].slice(0, 2));
  discard(g, 1, g.hands[1].slice(0, 2));
  assert.equal(g.phase, 'cut');
  assert.equal(g.turn, 1, 'the player who did not deal cuts');
  const want = g.deck[7];
  assert.throws(() => cutAt(g, 99), /No card/);
  cutAt(g, 7);
  assert.deepEqual(g.starter, want);
  assert.ok(g.phase === 'play' || g.phase === 'over');
  assert.equal(g.deck.length, 39);
});
