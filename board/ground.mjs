// Paints the ground of a place onto a QML Canvas 2D context: the earth,
// soft patches, specks of leaf or snow, a beach, the trail itself with its
// grain, the skunk lines and every hole. The 3D scene lays this over the
// rolling ground. Matches paintGround in design/trail-prototype.html.
//
// QML's context differs from the browser's in one call: ellipse() takes a
// bounding box (x, y, w, h), so specks are drawn through `oval` below.

import { WORLD, PLACES, LENGTH, samples, along, holeAt, skunkS, shoreX, SKUNK_LINES, rng } from './trail.mjs';

function oval(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x - rx, y - ry, rx * 2, ry * 2);
  g.fill();
}

// `scale` is canvas pixels per world unit.
export function paint(g, placeName, scale) {
  const P = PLACES[placeName];
  g.save();
  g.scale(scale, scale);
  const r = rng(placeName.length * 977 + 13);
  g.globalAlpha = 1;
  g.fillStyle = P.ground;
  g.fillRect(0, 0, WORLD.w, WORLD.h);
  for (let i = 0; i < 130; i++) {
    const x = r() * WORLD.w, y = r() * WORLD.h, rad = 60 + r() * 180;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, P.patches[i % 2]);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const specks = P.leaves ? 30000 : 16000;
  for (let i = 0; i < specks; i++) {
    g.fillStyle = P.specks[i % P.specks.length];
    g.globalAlpha = 0.35 + r() * 0.5;
    const x = r() * WORLD.w, y = r() * WORLD.h, rx = 1 + r() * 3, ry = 1 + r() * 2;
    r();
    oval(g, x, y, rx, ry);
  }
  g.globalAlpha = 1;
  if (P.water) {
    g.beginPath();
    g.moveTo(WORLD.w, 0);
    for (let y = 0; y <= WORLD.h; y += 10) g.lineTo(shoreX(y) + 30, y);
    g.lineTo(WORLD.w, WORLD.h);
    g.closePath();
    g.fillStyle = P.beach || '#7d7a6c';
    g.fill();
  }
  const line = function (w, color) {
    g.beginPath();
    for (let i = 0; i < samples.length; i++) {
      if (i) g.lineTo(samples[i][0], samples[i][1]); else g.moveTo(samples[i][0], samples[i][1]);
    }
    g.lineWidth = w;
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  };
  line(80, P.pathEdge);
  line(66, P.path);
  if (P.leaves) {
    // Fallen leaves drift onto the trail's edges.
    for (let i = 0; i < 2600; i++) {
      const p = along(r() * LENGTH), o = (r() < 0.5 ? -1 : 1) * (22 + r() * 18);
      g.fillStyle = P.specks[i % P.specks.length];
      g.globalAlpha = 0.55 + r() * 0.4;
      const rx = 1.6 + r() * 2.2, ry = 1 + r() * 1.2;
      r();
      oval(g, p.x + p.nx * o, p.y + p.ny * o, rx, ry);
    }
    g.globalAlpha = 1;
  }
  g.fillStyle = P.pathGrain;
  for (let i = 0; i < 3500; i++) {
    const p = along(r() * LENGTH), o = (r() - 0.5) * 58;
    const rad = 0.8 + r() * 1.6;
    oval(g, p.x + p.nx * o, p.y + p.ny * o, rad, rad);
  }
  const hole = function (h, rad) {
    g.fillStyle = P.rim;
    oval(g, h.x, h.y + 1.2, rad + 1.2, rad + 1);
    g.fillStyle = P.hole;
    oval(g, h.x, h.y, rad, rad);
  };
  // Skunk lines: a black band with a white stripe across the trail, just
  // past hole 90 (skunk) and hole 60 (double skunk, two stripes).
  for (let s = 0; s < SKUNK_LINES.length; s++) {
    const k = SKUNK_LINES[s][0], stripes = SKUNK_LINES[s][1];
    const p = along(skunkS(k));
    const across = function (w, color, off) {
      g.beginPath();
      g.moveTo(p.x - p.nx * 40 - p.ny * off, p.y - p.ny * 40 + p.nx * off);
      g.lineTo(p.x + p.nx * 40 - p.ny * off, p.y + p.ny * 40 + p.nx * off);
      g.lineWidth = w;
      g.strokeStyle = color;
      g.lineCap = 'butt';
      g.stroke();
    };
    across(stripes === 2 ? 14 : 10, '#141414', 0);
    if (stripes === 2) { across(2.4, '#F8F8FF', -3); across(2.4, '#F8F8FF', 3); } else across(3, '#F8F8FF', 0);
  }
  for (let k = 0; k <= 120; k++) {
    hole(holeAt(0, k), k === 0 ? 5.5 : 4.4);
    hole(holeAt(1, k), k === 0 ? 5.5 : 4.4);
  }
  hole(holeAt(0, 121), 7);
  g.restore();
}
