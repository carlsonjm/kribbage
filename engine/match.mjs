// A single game, or a match: best of 3, 5 or 7 games. A win counts one game, a skunk two and
// a double skunk three, so a match can end early. The loser of each game
// deals first in the next.

export const LENGTHS = [1, 3, 5, 7];

export function newMatch(bestOf = 7) {
  if (!LENGTHS.includes(bestOf)) throw new Error('A game is single, or best of 3, 5 or 7');
  return { bestOf, wins: [0, 0], games: 0, winner: null };
}

export function needed(match) {
  return (match.bestOf + 1) / 2;
}

// Records a finished game (its winner and skunk from game.mjs). Returns the
// dealer for the next game, or null when the match is over.
export function recordGame(match, winner, skunk = 0) {
  if (match.winner !== null) throw new Error('The match is already over');
  match.games++;
  match.wins[winner] = Math.min(needed(match), match.wins[winner] + 1 + skunk);
  if (match.wins[winner] >= needed(match)) {
    match.winner = winner;
    return null;
  }
  return 1 - winner;
}

// Changing the length mid-match keeps the games won.
export function setLength(match, bestOf) {
  if (!LENGTHS.includes(bestOf)) throw new Error('A game is single, or best of 3, 5 or 7');
  match.bestOf = bestOf;
  match.wins = match.wins.map((w) => Math.min(w, needed(match)));
  const n = needed(match);
  match.winner = match.wins[0] >= n ? 0 : match.wins[1] >= n ? 1 : null;
}
