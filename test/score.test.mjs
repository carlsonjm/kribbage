import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, parse } from '../engine/cards.mjs';
import { scoreHand, scorePlay } from '../engine/score.mjs';

const hand = (h, s, crib = false) => scoreHand(cards(h), s ? parse(s) : null, crib).total;
const peg = (p) => scorePlay(cards(p)).total;

test('the best hand there is', () => assert.equal(hand('5h 5c 5s Jd', '5d'), 29));
test('the mock-up hand', () => assert.equal(hand('4h 5c 6s 6d', '9c'), 16));
test('the crib helper number (no starter)', () => assert.equal(hand('4h 5c 6s 6d'), 12));
test('double double run', () => assert.equal(hand('3h 3d 4s 4c', '5h'), 20));
test('nobs', () => assert.equal(hand('Jh 2c 3d 9s', '4h'), 8));
test('four-card flush counts in a hand', () => assert.equal(hand('Ah 3h 7h 9h', 'Qs'), 4));
test('four-card flush does not count in a crib', () => assert.equal(hand('Ah 3h 7h 9h', 'Qs', true), 0));
test('five-card flush counts in a crib', () => assert.equal(hand('Ah 3h 7h 9h', 'Kh', true), 5));
test('nineteen: nothing', () => assert.equal(hand('2c 4d 6s 8h', 'Qc'), 0));
test('run of four is not two runs of three', () => assert.equal(hand('9c 10d Js Qh', 'Ac'), 4 + 0));
test('lines carry their cards', () => {
  const r = scoreHand(cards('4h 5c 6s 6d'), parse('9c'));
  const kinds = r.lines.map((l) => l.kind).sort();
  assert.deepEqual(kinds, ['fifteen', 'fifteen', 'fifteen', 'fifteen', 'pair', 'run', 'run']);
});

test('play: fifteen', () => assert.equal(peg('7s 8d'), 2));
test('play: pair', () => assert.equal(peg('7s 8d 8c'), 2));
test('play: three of a kind', () => assert.equal(peg('5s 5d 5c'), 6 + 2)); // 15 as well
test('play: four of a kind', () => assert.equal(peg('2s 2d 2c 2h'), 12));
test('play: run in order', () => assert.equal(peg('3s 4d 5c'), 3));
test('play: run out of order', () => assert.equal(peg('3s 5d 4c'), 3));
test('play: run of four', () => assert.equal(peg('4s 3d 5c 6h'), 4));
test('play: broken run', () => assert.equal(peg('3s 4d 4c 5h'), 0));
test('play: thirty-one', () => assert.equal(peg('Ks 7d 9c 5h'), 2));
test('play: face cards run', () => assert.equal(peg('Ks Qd Jc'), 3));
test('play: fifteen and a run', () => assert.equal(peg('4s 6d 5c'), 2 + 3));

import { handTotal } from '../engine/score.mjs';
import { newDeck, shuffle, rng } from '../engine/cards.mjs';
test('the quick total always matches the full count', () => {
  const random = rng(99);
  for (let i = 0; i < 20000; i++) {
    const d = shuffle(newDeck(), random);
    const crib = i % 3 === 0;
    assert.equal(handTotal(d.slice(0, 4), d[4], crib), scoreHand(d.slice(0, 4), d[4], crib).total);
    assert.equal(handTotal(d.slice(0, 4), null), scoreHand(d.slice(0, 4), null).total);
  }
});
