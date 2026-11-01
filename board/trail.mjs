// The trail board, as numbers: where the path runs, where every hole sits,
// the skunk lines, the three places it can run through and the shape of the
// ground in each. Plain JavaScript with no dependencies, shared by the 3D
// scene (qml/TrailScene.qml), the corner map and the node tests.
//
// World units match the approved prototype (design/trail-prototype.html):
// x runs east, y runs south on the map; in the 3D scene y becomes z and the
// height of the ground is up.

export const WORLD = { w: 2600, h: 2800 };
// Ground beyond the trail, so the camera never sees an edge.
export const PAD = 400;

// Seeded random so each place grows the same trees every time.
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

// A switchback path, four turns, a quarter of the game between each.
const CTRL = [
  [180, 1880], [520, 1895], [900, 1865], [1260, 1810], [1520, 1710], [1600, 1550], [1460, 1425],
  [1100, 1400], [760, 1390], [460, 1345], [290, 1250], [240, 1100], [380, 995], [640, 965],
  [960, 955], [1300, 925], [1530, 820], [1590, 650], [1450, 530], [1060, 515], [700, 500],
  [420, 455], [260, 360], [240, 210], [380, 125], [760, 110], [1150, 120]
].map(function (c) { return [c[0] + PAD, c[1] + PAD]; });

// Centripetal Catmull-Rom: passes through every point without overshoot or
// little loops at the tight turns.
function catmull(p0, p1, p2, p3, t) {
  const d = function (a, b) { return Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-4; };
  const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), u = t1 + (t2 - t1) * t;
  const L = function (a, b, ta, tb) {
    return [((tb - u) * a[0] + (u - ta) * b[0]) / (tb - ta), ((tb - u) * a[1] + (u - ta) * b[1]) / (tb - ta)];
  };
  const A1 = L(p0, p1, 0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  return L(L(A1, A2, 0, t2), L(A2, A3, t1, t3), t1, t2);
}

// The path as a dense polyline, and the distance along it at each point.
export const samples = [];
(function () {
  for (let i = 0; i < CTRL.length - 1; i++) {
    const p1 = CTRL[i], p2 = CTRL[i + 1];
    const p0 = i > 0 ? CTRL[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
    const p3 = i + 2 < CTRL.length ? CTRL[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
    for (let j = 0; j < 80; j++) samples.push(catmull(p0, p1, p2, p3, j / 80));
  }
  samples.push(CTRL[CTRL.length - 1]);
})();
const arc = [0];
for (let i = 1; i < samples.length; i++) {
  arc.push(arc[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]));
}
export const LENGTH = arc[arc.length - 1];

// The point `s` along the trail, with the unit normal (left of travel).
export function along(s) {
  s = Math.max(0, Math.min(LENGTH, s));
  let lo = 0, hi = arc.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arc[mid] < s) lo = mid; else hi = mid;
  }
  const f = (s - arc[lo]) / ((arc[hi] - arc[lo]) || 1);
  const a = samples[lo], b = samples[hi];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  return { x: a[0] + dx * f, y: a[1] + dy * f, nx: -dy / len, ny: dx / len };
}

// Holes 1..120 in groups of five, a start hole pair and one shared finish.
const START = 90, END_PAD = 90, GAP = 16;
const STEP = (LENGTH - START - END_PAD - 23 * GAP) / 119;
// You on one side, the computer on the other.
export const LANE = [14, -14];

export function sAt(k) {
  if (k <= 0) return START - 46;
  if (k >= 121) return START + 119 * STEP + 23 * GAP + 46;
  return START + (k - 1) * STEP + Math.floor((k - 1) / 5) * GAP;
}

// Skunk lines cross halfway between hole k and the next: [hole, stripes].
export const SKUNK_LINES = [[90, 1], [60, 2]];
export function skunkS(k) {
  return (sAt(k) + sAt(k + 1)) / 2;
}

export function holeAt(player, k) {
  const p = along(sAt(k));
  const off = k >= 121 ? 0 : LANE[player];
  return { x: p.x + p.nx * off, y: p.y + p.ny * off };
}

// The nearest point of the trail to (x, y), for a tap on the map.
export function nearestOnTrail(x, y) {
  let best = null, bd = 1e9;
  for (let i = 0; i < samples.length; i += 4) {
    const d = Math.hypot(samples[i][0] - x, samples[i][1] - y);
    if (d < bd) { bd = d; best = samples[i]; }
  }
  return { x: best[0], y: best[1], distance: bd };
}

// ---- Places. Each is a ground, a sky, and what grows beside the trail.
export const PLACE_NAMES = ['forest', 'autumn', 'winter'];
export const PLACES = {
  forest: {
    ground: '#25331f', specks: ['#2f4127', '#1b261a', '#3b4e2e', '#2a3522'], patches: ['rgba(72,100,56,0.35)', 'rgba(20,28,18,0.45)'],
    path: '#6f5a42', pathEdge: '#43362a', pathGrain: 'rgba(170,140,100,0.25)', hole: '#120d09', rim: 'rgba(210,180,140,0.35)',
    sky: '#a9b8a6', fog: '#7d8f7a', hemiSky: '#cfe0c8', hemiGround: '#2b3322', sun: '#ffe2b0', sunI: 1.5, hemiI: 0.55, hills: 26, exposure: 1.05,
    trees: [{ kind: 'pine', n: 520, s: 1, colors: ['#1f4029', '#26502f', '#2f6138'] },
            { kind: 'pine', n: 260, s: 0.7, colors: ['#24432a', '#2d5531', '#3a6a3a'] },
            { kind: 'bush', n: 140, s: 1, colors: ['#3d6334'] },
            { kind: 'rock', n: 50, s: 1, colors: ['#5f6159'] }]
  },
  autumn: {
    ground: '#4a2c30', specks: ['#7a3326', '#9a4a22', '#5e2438', '#b07a2c', '#6b3a2a', '#83282c'], patches: ['rgba(140,60,40,0.3)', 'rgba(60,24,40,0.4)'],
    path: '#8a7660', pathEdge: '#5a4636', pathGrain: 'rgba(214,190,150,0.22)', hole: '#1d1512', rim: 'rgba(235,215,185,0.3)',
    sky: '#c4b2a2', fog: '#a3918a', hemiSky: '#ead8c6', hemiGround: '#3a2228', sun: '#ffd2a0', sunI: 1.3, hemiI: 0.5, hills: 20, water: true, exposure: 0.95, beach: '#5c4a3e', leaves: true,
    trees: [{ kind: 'maple', n: 170, s: 1, colors: ['#b8402a', '#d0602c', '#9e2f2a'] },
            { kind: 'maple', n: 150, s: 0.9, colors: ['#d9902a', '#e4b13a', '#c47a24'] },
            { kind: 'maple', n: 90, s: 0.85, colors: ['#7a2a3e', '#93344a', '#6a2236'] },
            { kind: 'birch', n: 80, s: 1, colors: ['#ecebe6', '#e2b23a'] },
            { kind: 'pine', n: 120, s: 0.9, colors: ['#2a4330', '#33543b', '#3e6648'] },
            { kind: 'bush', n: 120, s: 1, colors: ['#8e3a2a'] },
            { kind: 'rock', n: 60, s: 1.2, colors: ['#77706a'] }]
  },
  winter: {
    ground: '#aab5c2', specks: ['#b6c0cc', '#9ba7b5', '#a3aebb', '#c0c9d4'], patches: ['rgba(200,210,224,0.35)', 'rgba(120,134,152,0.3)'],
    path: '#8794a5', pathEdge: '#6b7889', pathGrain: 'rgba(220,228,238,0.3)', hole: '#232931', rim: 'rgba(230,236,245,0.45)',
    sky: '#7f8fa3', fog: '#8695a8', hemiSky: '#c4d0de', hemiGround: '#55606e', sun: '#ffd9b8', sunI: 0.9, hemiI: 0.5, hills: 30, snow: true, exposure: 0.82,
    trees: [{ kind: 'pine', n: 420, s: 1, colors: ['#2b4a3c', '#335646', '#3e6452'] },
            { kind: 'birch', n: 260, s: 1, colors: ['#ecebe6', null] },
            { kind: 'rock', n: 50, s: 1, colors: ['#9aa2ac'] }]
  }
};

export function shoreX(y) {
  return 2040 + Math.sin(y / 140) * 60 + Math.sin(y / 53) * 18;
}
export function inWater(x, y) {
  return x > shoreX(y);
}

// Distance from any point to the trail, on a coarse grid, so the ground can
// stay flat along the trail and roll into hills away from it.
const CELL = 20, GW = Math.ceil(WORLD.w / CELL) + 1, GH = Math.ceil(WORLD.h / CELL) + 1;
let distGrid = null;
function buildDistGrid() {
  distGrid = new Float32Array(GW * GH);
  const pts = samples.filter(function (_, i) { return i % 3 === 0; });
  const px = new Float32Array(pts.length), py = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i++) { px[i] = pts[i][0]; py[i] = pts[i][1]; }
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const x = i * CELL, y = j * CELL;
      let best = 1e9;
      for (let k = 0; k < px.length; k++) {
        const dx = px[k] - x, dy = py[k] - y, d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
      distGrid[j * GW + i] = Math.sqrt(best);
    }
  }
}
export function distToTrail(x, y) {
  if (!distGrid) buildDistGrid();
  const i = Math.max(0, Math.min(GW - 1, Math.round(x / CELL)));
  const j = Math.max(0, Math.min(GH - 1, Math.round(y / CELL)));
  return distGrid[j * GW + i];
}
export function nearPath(x, y, d) {
  return distToTrail(x, y) < d;
}

function smooth(a, b, t) {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

// The height of the ground in a place: flat along the trail, rolling away
// from it, and sunk well below the water past the shore so no hilltop
// breaks the lake.
export function heightAt(placeName, x, y) {
  const P = PLACES[placeName];
  const d = distToTrail(x, y);
  let h = P.hills * (Math.sin(x / 173) * Math.cos(y / 211) + 0.6 * Math.sin((x + 2 * y) / 97) + 0.35 * Math.cos((x - y) / 61));
  h = (h + P.hills * 0.4) * smooth(60, 300, d);
  if (P.water) h -= (46 + P.hills * 2.5) * smooth(shoreX(y) - 40, shoreX(y) + 90, x);
  return h;
}

// Life along the trail, about one thing every 40 holes: a campfire, a
// critter, birds, each well off the path on one side.
export const AMBIENT_AT = [[20, 1], [62, -1], [102, 1]];
export function ambientSpots() {
  return AMBIENT_AT.map(function (a) {
    const p = along(sAt(a[0]));
    return { x: p.x + p.nx * 105 * a[1], y: p.y + p.ny * 105 * a[1] };
  });
}

// Trail markers: Start, each quarter, and the two skunk boards. Each is
// { x, y, text, sub } with sub set on the black skunk boards.
export function signs() {
  const out = [];
  const post = function (k, text, sub) {
    const p = k === 0 ? along(sAt(0) - 70) : along(sub ? skunkS(k) : sAt(k));
    const side = k === 0 ? 0 : sub ? -66 : 60;
    out.push({ x: p.x + p.nx * side, y: p.y + p.ny * side, text: text, sub: sub || '' });
  };
  post(0, 'Start'); post(30, '30'); post(60, '60'); post(90, '90');
  post(90, 'Skunk', 'under 91'); post(60, 'Double', 'under 61');
  return out;
}

// Where the trees, bushes and rocks of one place stand: per kind, a list of
// [x, y, scale, scaleY, turn, tilt], the same every time.
export function plantings(placeName) {
  const P = PLACES[placeName];
  const r = rng(placeName.length * 131 + 7);
  const clear = ambientSpots().slice(0, 2);
  return P.trees.map(function (it) {
    const spots = [];
    let tries = 0;
    while (spots.length < it.n && tries++ < it.n * 30) {
      const x = -300 + r() * (WORLD.w + 600), y = -300 + r() * (WORLD.h + 600);
      if (P.water && inWater(x - 20, y)) continue;
      if (nearPath(x, y, it.kind === 'bush' ? 50 : it.kind === 'rock' ? 52 : 66)) continue;
      const room = it.kind === 'bush' ? 50 : 75;
      if (clear.some(function (c) { return Math.hypot(c.x - x, c.y - y) < room; })) continue;
      if (it.kind === 'bush' && !nearPath(x, y, 140)) continue;
      spots.push([x, y]);
    }
    const placed = spots.map(function (s) {
      const sc = it.s * (0.75 + r() * 0.55);
      const tilt = it.kind === 'rock' ? r() * 0.4 : 0;
      const turn = r() * Math.PI * 2;
      const sy = sc * (it.kind === 'rock' ? 0.6 + r() * 0.6 : 1);
      return [s[0], s[1], sc, sy, turn, tilt];
    });
    return { kind: it.kind, colors: it.colors, spots: placed };
  });
}
