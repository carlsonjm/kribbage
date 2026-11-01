// Cards, the deck and a seeded shuffle. Plain JavaScript with no
// dependencies, so the same file loads in QML and in node.

export const SUITS = ['s', 'h', 'd', 'c'];
export const SUIT_NAMES = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
export const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// A card is { rank: 1..13, suit: 's'|'h'|'d'|'c', id: '5h' }.
export function card(rank, suit) {
  return { rank, suit, id: RANK_LABELS[rank] + suit };
}

// Reads '5h', '10s', 'Jd', 'Ac' into a card.
export function parse(id) {
  const suit = id.slice(-1);
  const label = id.slice(0, -1).toUpperCase();
  const rank = RANK_LABELS.indexOf(label);
  if (rank < 1 || !SUITS.includes(suit)) throw new Error('Not a card: ' + id);
  return card(rank, suit);
}

export function cards(text) {
  return text.trim().split(/\s+/).map(parse);
}

// What a card counts toward fifteen and thirty-one.
export function value(c) {
  return c.rank > 10 ? 10 : c.rank;
}

export function label(c) {
  return RANK_LABELS[c.rank] + ' of ' + SUIT_NAMES[c.suit];
}

export function newDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) deck.push(card(rank, suit));
  }
  return deck;
}

// mulberry32: small, fast, and good enough to shuffle cards. A seed makes a
// game repeatable, which the tests and any "replay this deal" need.
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(deck, random) {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

export function sameCard(a, b) {
  return a.rank === b.rank && a.suit === b.suit;
}

export function without(hand, gone) {
  return hand.filter((c) => !gone.some((g) => sameCard(c, g)));
}
