import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, discard, play, sayGo, mustSayGo, takeEvents } from '../engine/game.mjs';
import { chooseDiscard, choosePlay } from '../engine/ai.mjs';
import { rng, shuffle, without, newDeck } from '../engine/cards.mjs';

// The computer must not peek. Swap the person's hand and the deck for other
// unseen cards and its every choice must stay the same.
test('the computer never sees your hand or the deck', () => {
  for (let seed = 1; seed <= 150; seed++) {
    for (const level of ['easy', 'steady', 'sharp']) {
      const g = newGame({ seed });
      const r = rng(seed);
      discard(g, 0, g.hands[0].slice(0, 2));
      discard(g, 1, chooseDiscard(g.hands[1], g.dealer === 1, level, rng(seed)));
      let turns = 0;
      while (g.phase === 'play' && turns++ < 20) {
        const p = g.turn;
        if (p === 1 && !mustSayGo(g, 1)) {
          // A copy where everything the computer cannot see is reshuffled.
          const seen = g.hands[1].concat(g.starter, ...g.pastPiles, g.pile);
          const hidden = shuffle(without(newDeck(), seen), rng(seed * 31 + turns));
          const other = Object.assign({}, g, {
            hands: [hidden.slice(0, g.hands[0].length), g.hands[1]],
            deck: hidden.slice(g.hands[0].length)
          });
          const a = choosePlay(g, 1, level, rng(seed + turns));
          const b = choosePlay(other, 1, level, rng(seed + turns));
          assert.equal(a.id, b.id, `seed ${seed} ${level}`);
        }
        if (mustSayGo(g, p)) sayGo(g, p);
        else play(g, p, choosePlay(g, p, level, r));
        takeEvents(g);
      }
    }
  }
});
