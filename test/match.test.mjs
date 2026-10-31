import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, recordGame, needed, setLength } from '../engine/match.mjs';

test('best of 7 is first to 4, and the loser deals next', () => {
  const m = newMatch(7);
  assert.equal(needed(m), 4);
  assert.equal(recordGame(m, 0), 1);
  assert.equal(recordGame(m, 1), 0);
  assert.equal(recordGame(m, 0), 1);
  assert.equal(recordGame(m, 0), 1);
  assert.equal(recordGame(m, 0), null);
  assert.equal(m.winner, 0);
  assert.deepEqual(m.wins, [4, 1]);
  assert.throws(() => recordGame(m, 1));
});

test('skunks count two games, double skunks three', () => {
  const m = newMatch(5);
  recordGame(m, 1, 1);
  assert.deepEqual(m.wins, [0, 2]);
  assert.equal(recordGame(m, 1, 2), null, 'a double skunk can finish a match');
  assert.deepEqual(m.wins, [0, 3]);
  const short = newMatch(3);
  assert.equal(recordGame(short, 0, 1), null, 'one skunk wins a best of 3');
});

test('changing the length keeps the games won', () => {
  const m = newMatch(7);
  recordGame(m, 0); recordGame(m, 0); recordGame(m, 1);
  setLength(m, 3);
  assert.deepEqual(m.wins, [2, 1]);
  assert.equal(m.winner, 0);
  assert.throws(() => newMatch(4));
  const single = newMatch(1);
  assert.equal(recordGame(single, 1), null, 'a single game is its own match');
});
