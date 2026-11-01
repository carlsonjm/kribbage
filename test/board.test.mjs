import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../board/trail.mjs';
import * as M from '../board/meshes.mjs';
import * as S from '../board/scene.mjs';
import * as G from '../board/ground.mjs';

test('holes run forward along the trail, the two lanes apart', () => {
  let last = -1;
  for (let k = 0; k <= 121; k++) {
    const s = T.sAt(k);
    assert.ok(s > last, 'hole ' + k + ' comes after the one before');
    last = s;
  }
  for (let k = 1; k <= 120; k++) {
    const a = T.holeAt(0, k), b = T.holeAt(1, k);
    assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 28) < 1, 'lanes 28 apart at hole ' + k);
  }
  assert.ok(T.sAt(121) <= T.LENGTH, 'the finish is on the trail');
});

test('skunk lines sit between holes 90 and 91, and 60 and 61', () => {
  for (const [k] of T.SKUNK_LINES) {
    assert.ok(T.skunkS(k) > T.sAt(k) && T.skunkS(k) < T.sAt(k + 1));
  }
});

test('the ground is flat along the trail in every place', () => {
  for (const place of T.PLACE_NAMES) {
    for (let k = 0; k <= 121; k += 7) {
      const h = T.holeAt(0, k);
      assert.ok(Math.abs(T.heightAt(place, h.x, h.y)) < 1e-6, place + ' hole ' + k);
    }
  }
});

test('trees keep off the trail and out of the lake', () => {
  for (const place of T.PLACE_NAMES) {
    for (const stand of T.plantings(place)) {
      assert.ok(stand.spots.length > 0, place + ' grows ' + stand.kind);
      for (const s of stand.spots) {
        assert.ok(T.distToTrail(s[0], s[1]) >= 49, place + ' ' + stand.kind + ' off the trail');
        if (T.PLACES[place].water) assert.ok(!T.inWater(s[0] - 20, s[1]));
      }
    }
  }
  assert.deepEqual(T.plantings('forest')[0].spots.slice(0, 3), T.plantings('forest')[0].spots.slice(0, 3), 'the same every time');
});

test('the polyhedra are made of hull faces', () => {
  for (const name of Object.keys(M.POLYHEDRA)) {
    const [V, F] = M.POLYHEDRA[name];
    const pts = [];
    for (let i = 0; i < V.length; i += 3) pts.push([V[i], V[i + 1], V[i + 2]]);
    for (let f = 0; f < F.length; f += 3) {
      const [a, b, c] = [pts[F[f]], pts[F[f + 1]], pts[F[f + 2]]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const sides = pts.map((p) => n[0] * (p[0] - a[0]) + n[1] * (p[1] - a[1]) + n[2] * (p[2] - a[2]));
      assert.ok(sides.every((d) => d <= 1e-9) || sides.every((d) => d >= -1e-9), name + ' face ' + f / 3);
    }
  }
});

test('every triangle faces outward', () => {
  const shapes = [M.cylinder(3, 4, 10, 7), M.cone(3, 6, 5), M.sphere(5, 12, 8), M.icosahedron(4), M.dodecahedron(4), M.box(2, 3, 4)];
  for (const tris of shapes) {
    for (const t of tris) {
      const [a, b, c] = t.p;
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const centre = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      assert.ok(n[0] * centre[0] + n[1] * centre[1] + n[2] * centre[2] > 0);
    }
  }
});

test('the scene builds for every place and peg', () => {
  for (const place of T.PLACE_NAMES) {
    const g = S.ground(place);
    assert.equal(g.vertices.length, g.count * M.STRIDE);
    assert.ok(g.indices.every((i) => i < g.count));
    for (const stand of S.forest(place)) {
      assert.equal(stand.vertices.length, stand.count * M.STRIDE);
      assert.ok(stand.vertices.every(Number.isFinite), place + ' ' + stand.kind + ' has no holes in it');
    }
  }
  for (const style of S.PEG_STYLES) {
    for (const lit of [true, false]) {
      const parts = S.pegParts(style, lit);
      assert.ok(parts.length > 0);
      for (const p of parts) assert.ok(p.count > 0 && p.vertices.every(Number.isFinite), style);
    }
  }
});

test('the ground paints with the calls QML offers', () => {
  const calls = {};
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args) => { calls[name] = (calls[name] || 0) + 1; return args; };
    },
    set() { return true; }
  });
  for (const place of T.PLACE_NAMES) G.paint(ctx, place, 1);
  assert.ok(calls.ellipse > 1000 && calls.stroke > 0);
});
