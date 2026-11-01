// What stands on the trail board, as meshes for the 3D scene: the rolling
// ground, the trees, bushes and rocks of each place, the pegs in each style,
// and the campfire, critter and birds. Shapes and sizes follow the approved
// prototype (design/trail-prototype.html).

import { WORLD, PLACES, heightAt, plantings } from './trail.mjs';
import { STRIDE, matrix, multiply as multiplyM, merge, stamp, cylinder, cone, sphere, icosahedron, dodecahedron, box, torus, wing, card } from './meshes.mjs';

// ---- The ground: a grid over the board, lifted to the place's hills, with
// texture coordinates for the painted ground (board/ground.mjs).
export const GROUND_COLS = 260, GROUND_ROWS = 280;
export function ground(placeName) {
  const cols = GROUND_COLS, rows = GROUND_ROWS;
  const n = (cols + 1) * (rows + 1);
  const heights = new Float32Array(n);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) heights[j * (cols + 1) + i] = heightAt(placeName, i / cols * WORLD.w, j / rows * WORLD.h);
  }
  const dx = WORLD.w / cols, dz = WORLD.h / rows;
  const h = function (i, j) {
    return heights[Math.max(0, Math.min(rows, j)) * (cols + 1) + Math.max(0, Math.min(cols, i))];
  };
  const vertices = new Float32Array(n * STRIDE);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const o = (j * (cols + 1) + i) * STRIDE;
      // Normal from the slopes either side.
      const sx = (h(i + 1, j) - h(i - 1, j)) / (2 * dx), sz = (h(i, j + 1) - h(i, j - 1)) / (2 * dz);
      const l = Math.hypot(sx, 1, sz);
      vertices[o] = i * dx; vertices[o + 1] = h(i, j); vertices[o + 2] = j * dz;
      vertices[o + 3] = -sx / l; vertices[o + 4] = 1 / l; vertices[o + 5] = -sz / l;
      vertices[o + 6] = i / cols; vertices[o + 7] = 1 - j / rows;
      vertices[o + 8] = 1; vertices[o + 9] = 1; vertices[o + 10] = 1; vertices[o + 11] = 1;
    }
  }
  const indices = new Uint32Array(cols * rows * 6);
  let k = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
      // Counter-clockwise seen from above (+y).
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    }
  }
  return { vertices: vertices, indices: indices, count: n };
}

// ---- Trees, bushes and rocks.
function M(x, y, z, rx, ry, rz, sx, sy, sz) {
  return matrix(x, y, z, rx, ry, rz, sx || 1, sy || 1, sz || 1);
}
export function treeParts(kind, colors, snow) {
  if (kind === 'pine') {
    const parts = [{ tris: cylinder(2.6, 3.6, 26, 6), matrix: M(0, 13), color: '#4a3424' }];
    [[28, 40, 36], [22, 36, 58], [15, 32, 78]].forEach(function (t, i) {
      parts.push({ tris: cone(t[0], t[1], 7), matrix: M(0, t[2], 0, 0, i * 0.5), color: colors[i] });
      if (snow) parts.push({ tris: cone(t[0] * 0.62, t[1] * 0.5, 7), matrix: M(0, t[2] + t[1] * 0.27, 0, 0, i * 0.5), color: '#d6dde6' });
    });
    return parts;
  }
  if (kind === 'birch') {
    const parts = [{ tris: cylinder(2.4, 3, 96, 6), matrix: M(0, 48), color: colors[0] }];
    [[30, 0.6, 0.3], [52, -0.7, 1.9], [70, 0.5, 3.6], [84, -0.4, 5]].forEach(function (b) {
      parts.push({ tris: cylinder(0.8, 1.2, 26, 4), matrix: M(Math.sin(b[1]) * -12 * Math.cos(b[2]), b[0] + 9, Math.sin(b[2]) * 6, 0, b[2], b[1]), color: colors[0] });
    });
    [14, 40, 63, 88].forEach(function (y) { parts.push({ tris: cylinder(2.55, 2.55, 3, 6), matrix: M(0, y), color: '#2a2a2a' }); });
    if (colors[1]) parts.push({ tris: icosahedron(22), matrix: M(0, 96, 0, 0, 0, 0, 1, 0.8, 1), color: colors[1] });
    return parts;
  }
  if (kind === 'maple') {
    // A broad, rounded crown made of leafy lumps.
    const parts = [{ tris: cylinder(2.6, 3.8, 40, 6), matrix: M(0, 20), color: '#4b3226' },
                   { tris: cylinder(1, 1.4, 22, 4), matrix: M(-7, 40, 0, 0, 0, 0.7), color: '#4b3226' }];
    [[0, 58, 0, 26, colors[0]], [-15, 50, 8, 18, colors[1]], [14, 50, -6, 19, colors[2]], [4, 70, -4, 16, colors[1]]].forEach(function (l) {
      parts.push({ tris: icosahedron(l[3]), matrix: M(l[0], l[1], l[2], 0, l[0], 0, 1, 0.85, 1), color: l[4] });
    });
    return parts;
  }
  if (kind === 'bush') return [{ tris: icosahedron(1), matrix: M(0, 5, 0, 0, 0, 0, 15, 11, 15), color: colors[0] }];
  return [{ tris: dodecahedron(1), matrix: M(0, 4, 0, 0, 0, 0, 22, 13, 17), color: colors[0] }];
}

// Every tree of a place, one mesh per kind and colourway.
export function forest(placeName) {
  const P = PLACES[placeName];
  return plantings(placeName).map(function (stand) {
    const parts = treeParts(stand.kind, stand.colors, !!P.snow);
    const placements = stand.spots.map(function (s) {
      return matrix(s[0], heightAt(placeName, s[0], s[1]) - 1, s[1], s[5], s[4], 0, s[2], s[3], s[2]);
    });
    const mesh = stamp(parts, placements);
    return { kind: stand.kind, vertices: mesh.vertices, count: mesh.count };
  });
}

// ---- Pegs. Player colours: red for you, blue for the computer, on every
// set. A peg is a list of parts, each a mesh with its own finish:
// { vertices, count, finish, node }. `finish` names a material the scene
// knows; `node` names a part that moves on its own (the firefly's orb, the
// crystal's main point).
export const TONES = [
  { main: '#C8241C', dark: '#5e1612', light: '#ff8a7a' },
  { main: '#1F5BC8', dark: '#14306a', light: '#8ab4ff' }
];
export const PEG_STYLES = ['brass', 'slim', 'firefly', 'toadstool', 'crystal'];
export const PEG_NAMES = { brass: 'Brass', slim: 'Classic', firefly: 'Fireflies', toadstool: 'Toadstools', crystal: 'Crystals' };

function part(tris, m, finish, node) {
  const mesh = merge([{ tris: tris, matrix: m }]);
  return { vertices: mesh.vertices, count: mesh.count, finish: finish, node: node || '' };
}
function parts(list, finish, node) {
  const mesh = merge(list);
  return { vertices: mesh.vertices, count: mesh.count, finish: finish, node: node || '' };
}

// Finishes: brass, darkwood, enamel (the player's colour, lit or not),
// glow (bright, the firefly orb), halo (soft see-through glow), stem,
// spot, glass (crystal), stone, core (crystal's lit heart).
export function pegParts(style, lit) {
  if (style === 'brass') {
    // A tournament-board peg: polished brass, enamel top in red or blue.
    return [
      part(cylinder(2.6, 1.6, 30, 16, true), M(0, 15), 'brass'),
      part(torus(3.2, 0.9, 8, 20), M(0, 30, 0, Math.PI / 2), 'brass'),
      part(cylinder(5.6, 4.6, 6, 20, true), M(0, 34), 'brass'),
      part(sphere(5.4, 20, 10, Math.PI / 2), M(0, 37, 0, 0, 0, 0, 1, 0.55, 1), 'enamel')
    ];
  }
  if (style === 'firefly') {
    // A thin stake with a glowing orb that drifts above it.
    const out = [
      part(cylinder(0.9, 1.3, 26, 6), M(0, 13), 'darkwood'),
      part(torus(2.4, 0.5, 6, 14), M(0, 26, 0, Math.PI / 2), 'brass'),
      part(sphere(lit ? 4 : 2.6, 18, 12), M(0, 0, 0), 'glow', 'orb')
    ];
    if (lit) out.push(part(sphere(7, 16, 10), M(0, 0, 0), 'halo', 'orb'));
    return out;
  }
  if (style === 'toadstool') {
    // A pale stem, a cap in the player's colour, soft spots.
    const spots = [[0, 25.2, 0], [5, 22.5, 3], [-5, 22.4, 3.2], [3.5, 23, -5], [-4.2, 22.8, -4.4]].map(function (s) {
      return { tris: sphere(1.3, 8, 6), matrix: M(s[0], s[1], s[2], 0, 0, 0, 1, 0.45, 1) };
    });
    return [
      part(cylinder(2.6, 3.4, 20, 12, true), M(0, 10), 'stem'),
      part(sphere(9, 20, 12, Math.PI / 2), M(0, 19, 0, 0, 0, 0, 1, 0.75, 1), 'enamel'),
      parts(spots, 'spot')
    ];
  }
  if (style === 'crystal') {
    // A cluster of six-sided quartz points on a rough stone, lit from a
    // core inside the main point. The dark one is smoky quartz.
    const point = function (r, h) {
      return [{ tris: cylinder(r, r * 1.05, h, 6), matrix: M(0, h / 2) },
              { tris: cone(r, r * 2.1, 6), matrix: M(0, h + r * 1.05) }];
    };
    const placed = function (r, h, x, z, lean, turn, tilt) {
      const outer = matrix(x, 4, z, tilt || 0, turn, lean);
      return point(r, h).map(function (p) {
        return { tris: p.tris, matrix: multiplyM(outer, p.matrix) };
      });
    };
    const out = [
      parts(point(4.6, 26), 'glass', 'main'),
      parts(placed(2.6, 13, 5.2, 2.4, -0.42, 1.1).concat(placed(2.1, 9, -4.6, 1.8, 0.5, 2.3), placed(1.6, 7, -1.2, -4.6, 0.25, 0.8, -0.45)), 'glass'),
      part(dodecahedron(7), M(0, 2.5, 0, 0, 0, 0, 1.25, 0.55, 1.1), 'stone')
    ];
    if (lit) out.push(part(cylinder(1.4, 1.4, 22, 6), M(0, 15), 'core'));
    return out;
  }
  // Classic: a slim shaft with a rounded head.
  return [
    part(cylinder(3.2, 2.4, 34, 14, true), M(0, 17), 'enamel'),
    part(cylinder(4.2, 4.2, 2.4, 16, true), M(0, 33), 'enamel'),
    part(sphere(4.2, 16, 10, Math.PI / 2), M(0, 34), 'enamel')
  ];
}

// ---- Life along the trail.
export function campfireParts(stoneColor) {
  const stones = [], logs = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    stones.push({ tris: dodecahedron(4.2), matrix: M(Math.cos(a) * 15, 2, Math.sin(a) * 15, i, i * 2, 0), color: stoneColor });
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.4;
    // A log leaning into the fire: turned to face out, then tipped.
    logs.push({ tris: cylinder(1.8, 2.2, 26, 6), matrix: multiplyM(matrix(Math.cos(a) * 4, 7, Math.sin(a) * 4, 0, -a, 0), matrix(0, 0, 0, 0, 0, 1.05)), color: '#5b3f2a' });
  }
  logs.push({ tris: cylinder(5, 5, 40, 8), matrix: M(-38, 5, 14, 0, 0.5, Math.PI / 2), color: '#5b3f2a' });
  return merge(stones.concat(logs));
}

export function critterParts(fox, coat, pale) {
  const ball = sphere(1, 10, 8);
  const body = [], head = [];
  const add = function (to, tris, color, px, py, pz, sx, sy, sz, rx, rz) {
    to.push({ tris: tris, matrix: M(px, py, pz, rx || 0, 0, rz || 0, sx || 1, sy || 1, sz || 1), color: color });
  };
  const dark = '#2a2522';
  if (fox) {
    add(body, ball, coat, 0, 13, 0, 7, 6.5, 13);
    add(body, ball, pale, 0, 10, 4, 5, 4.5, 7);
    [[-3.5, 7], [3.5, 7], [-3.5, -7], [3.5, -7]].forEach(function (l) { add(body, cylinder(1.3, 1.1, 9, 5), dark, l[0], 4.5, l[1]); });
    add(body, ball, coat, 0, 14, -17, 4, 4, 11, -0.6);
    add(body, ball, pale, 0, 17.5, -25, 2.6, 2.6, 3.6, 0.5);
    add(head, ball, coat, 0, 0, 0, 5.5, 5, 5.5);
    add(head, cone(2.6, 8, 5), pale, 0, -1.2, 6, 1, 1, 1, Math.PI / 2);
    add(head, ball, dark, 0, -1.2, 10, 1.1, 1.1, 1.1);
    add(head, cone(2.4, 6, 4), coat, -3, 5.5, -0.5);
    add(head, cone(2.4, 6, 4), coat, 3, 5.5, -0.5);
  } else {
    add(body, ball, coat, 0, 10, 0, 7, 7.5, 9.5);
    add(body, ball, pale, 0, 12, -9, 3.2, 3.2, 3.2);
    [[-4, 6], [4, 6]].forEach(function (l) { add(body, ball, coat, l[0], 3, l[1], 1.6, 2.4, 2.6); });
    [[-5, -4], [5, -4]].forEach(function (l) { add(body, ball, coat, l[0], 3, l[1], 2.6, 2.8, 6); });
    add(head, ball, coat, 0, 0, 0, 4.6, 4.8, 5.6);
    add(head, ball, dark, 0, -0.8, 5.4, 0.9, 0.8, 0.8);
    add(head, ball, coat, -1.8, 9, -1.5, 1.4, 6, 0.8, -0.15, 0.15);
    add(head, ball, coat, 1.8, 9, -1.5, 1.4, 6, 0.8, -0.15, -0.15);
  }
  return { body: merge(body), head: merge(head), headAt: fox ? [0, 21, 12] : [0, 18, 8] };
}

export function birdParts() {
  return {
    body: merge([{ tris: sphere(1, 6, 4, Math.PI, false), matrix: M(0, 0, 0, 0, 0, 0, 2, 2, 6), color: '#2b2a28' }]),
    wing: merge([{ tris: wing([0, 0, -3], [0, 0, 4], [13, 0, -1]), color: '#2b2a28' }]),
    flame: merge([{ tris: cone(1, 1, 6), matrix: M(0, 0.5) }]),
    puff: merge([{ tris: icosahedron(5) }])
  };
}

// The finish flag and the sign boards.
export function signParts(board) {
  return {
    pole: merge([{ tris: box(5, 52, 5), matrix: M(0, 26), color: board }]),
    board: merge([{ tris: box(52, 26, 4), matrix: M(0, 52), color: board }])
  };
}
export function flagParts() {
  return {
    pole: merge([{ tris: cylinder(1.4, 1.4, 90, 6, true), color: '#d8d8e0' }]),
    cloth: merge([{ tris: card(34, 20), color: '#F8F8FF' }])
  };
}
