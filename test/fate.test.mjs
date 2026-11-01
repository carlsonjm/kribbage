import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, discard, cutAt, takeEvents } from '../engine/game.mjs';
import { chooseDiscard } from '../engine/ai.mjs';
import { rng } from '../engine/cards.mjs';
import { handTotal } from '../engine/score.mjs';
import { newFate, noteEvent, chooseCut, rankCuts, isFull, setOn } from '../engine/fate.mjs';

function atCut(seed) {
  const g = newGame({ seed, manualCut: true });
  const random = rng(seed);
  for (const p of [0, 1]) discard(g, p, chooseDiscard(g.hands[p], g.dealer === p, 'steady', random));
  assert.equal(g.phase, 'cut');
  return g;
}

test('each deal, thin hands of your own and big computer scores fill the meter', () => {
  const f = newFate();
  assert.equal(noteEvent(f, { type: 'deal', dealer: 0, hand: 1 }), 0, 'a new game starts empty');
  assert.equal(noteEvent(f, { type: 'deal', dealer: 1, hand: 2 }), 20);
  assert.equal(noteEvent(f, { type: 'show', step: 'pone', player: 0, total: 2 }), 45);
  assert.equal(noteEvent(f, { type: 'show', step: 'dealer', player: 0, total: 8 }), 0);
  assert.equal(noteEvent(f, { type: 'show', step: 'crib', player: 0, total: 5 }), 0, 'an ordinary crib is not bad luck');
  assert.equal(noteEvent(f, { type: 'score', player: 1, reason: 'play', points: 2 }), 0);
  assert.equal(noteEvent(f, { type: 'score', player: 1, reason: 'play', points: 4 }), 10);
  assert.equal(f.level, 75);
  assert.equal(noteEvent(f, { type: 'show', step: 'pone', player: 1, total: 10 }), 20);
  assert.equal(noteEvent(f, { type: 'show', step: 'dealer', player: 0, total: 4 }), 5, 'the meter stops at full');
  assert.equal(f.level, 100);
  assert.ok(isFull(f));
  const g = newFate();
  assert.equal(noteEvent(g, { type: 'show', step: 'pone', player: 0, total: 6 }), 12, 'a so-so hand adds a little');
});

test('switched off, the meter stays empty and never touches the cut', () => {
  const f = newFate({ on: false });
  noteEvent(f, { type: 'show', step: 'pone', player: 0, total: 0 });
  assert.equal(f.level, 0);
  const f2 = newFate(); f2.level = 100; setOn(f2, false);
  assert.equal(f2.level, 0);
  const g = atCut(3);
  assert.equal(chooseCut(f2, g, true, rng(1)).fated, false);
});

test('calling on a full meter turns the best card for your hand and empties it', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = atCut(seed);
    const f = newFate(); f.level = 100;
    const best = rankCuts(g)[0].worth;
    const c = chooseCut(f, g, true, rng(seed));
    assert.ok(c.fated);
    assert.equal(f.level, 0);
    const keep = g.hands[0].slice(), crib = g.crib.slice(), mine = g.dealer === 0;
    cutAt(g, c.index);
    const worth = handTotal(keep, g.starter) + (mine ? handTotal(crib, g.starter, true) * 0.5 : 0);
    assert.equal(worth, best);
    takeEvents(g);
  }
});

test('calling on a meter that is not full is an ordinary cut', () => {
  const g = atCut(5);
  const f = newFate(); f.level = 60;
  const c = chooseCut(f, g, true, rng(2));
  assert.equal(c.fated, false);
  assert.equal(f.level, 60);
});

test('an empty meter never leans; a filling one sometimes does, and halves', () => {
  let leaned = 0;
  const random = rng(77);
  for (let i = 0; i < 2000; i++) {
    const g = atCut(1000 + (i % 50));
    const empty = newFate();
    assert.equal(chooseCut(empty, g, false, random).fated, false);
    const half = newFate(); half.level = 80;
    const c = chooseCut(half, g, false, random);
    if (c.fated) { leaned++; assert.equal(half.level, 40); } else assert.equal(half.level, 80);
  }
  // 80 / 400 = one cut in five.
  assert.ok(leaned > 300 && leaned < 500, 'leaned ' + leaned);
});
