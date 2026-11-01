// Shapes for the trail scene, built as flat vertex arrays the scene hands to
// MeshGeometry (src/meshgeometry.h). Every vertex is 12 floats: position,
// normal, texture coordinate, then colour (linear RGBA). Shapes match the
// prototype's (design/trail-prototype.html), which used three.js primitives.
//
// A part is { tris, color, matrix }: a list of triangles from one of the
// primitives below, its colour, and where it sits. `merge` joins parts into
// one array, so a tree of a trunk and three cones is a single mesh.

export const STRIDE = 12;

// ---- Colour: '#rrggbb' to linear RGB, as the scene's lighting expects.
function toLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function linear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
}

// ---- Matrices: column-major 4x4, three.js Euler order XYZ.
export function matrix(x, y, z, rx, ry, rz, sx, sy, sz) {
  rx = rx || 0; ry = ry || 0; rz = rz || 0;
  sx = sx === undefined ? 1 : sx; sy = sy === undefined ? sx : sy; sz = sz === undefined ? sx : sz;
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  // Rotation R = Rx * Ry * Rz, as three.js composes 'XYZ'.
  const r = [
    c * e, af + be * d, bf - ae * d,
    -c * f, ae - bf * d, be + af * d,
    d, -b * c, a * c
  ];
  return [
    r[0] * sx, r[1] * sx, r[2] * sx, 0,
    r[3] * sy, r[4] * sy, r[5] * sy, 0,
    r[6] * sz, r[7] * sz, r[8] * sz, 0,
    x || 0, y || 0, z || 0, 1
  ];
}
export function multiply(m, n) {
  const o = new Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += m[k * 4 + row] * n[col * 4 + k];
      o[col * 4 + row] = s;
    }
  }
  return o;
}

// ---- Triangles. Each is [ax, ay, az, bx, by, bz, cx, cy, cz] with its
// normals [na, nb, nc] (each [x, y, z]), counter-clockwise seen from outside.
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// A triangle of a convex shape around the origin: turned to face outward,
// with a flat normal unless smooth normals are given.
function outward(out, a, b, c, na, nb, nc) {
  const n = cross(sub(b, a), sub(c, a));
  if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return;
  const centre = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  const flat = norm(n);
  if (dot(n, centre) < 0) {
    out.push({ p: [a, c, b], n: na ? [na, nc, nb] : [[-flat[0], -flat[1], -flat[2]], [-flat[0], -flat[1], -flat[2]], [-flat[0], -flat[1], -flat[2]]] });
  } else {
    out.push({ p: [a, b, c], n: na ? [na, nb, nc] : [flat, flat, flat] });
  }
}

// Centred on the origin, from -h/2 to h/2, like three's CylinderGeometry.
export function cylinder(rTop, rBottom, h, seg, smooth) {
  const out = [];
  const slope = (rBottom - rTop) / h;
  const ring = function (r, y) {
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const t = i / seg * Math.PI * 2;
      pts.push([r * Math.sin(t), y, r * Math.cos(t)]);
    }
    return pts;
  };
  const top = ring(rTop, h / 2), bottom = ring(rBottom, -h / 2);
  const sideN = function (i) {
    const t = i / seg * Math.PI * 2;
    return norm([Math.sin(t), slope, Math.cos(t)]);
  };
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    const n = smooth ? [sideN(i), sideN(j)] : null;
    if (rTop > 0) outward(out, top[i], bottom[i], top[j], n && n[0], n && n[0], n && n[1]);
    outward(out, bottom[i], bottom[j], top[j], n && n[0], n && n[1], n && n[1]);
    if (rTop > 0) outward(out, [0, h / 2, 0], top[i], top[j]);
    outward(out, [0, -h / 2, 0], bottom[i], bottom[j]);
  }
  return out;
}
export function cone(r, h, seg, smooth) {
  return cylinder(0, r, h, seg, smooth);
}

// A sphere, or the top part of one (thetaLength below PI), like three's.
export function sphere(r, ws, hs, thetaLength, smooth) {
  thetaLength = thetaLength === undefined ? Math.PI : thetaLength;
  smooth = smooth === undefined ? true : smooth;
  const out = [];
  const at = function (u, v) {
    const phi = u / ws * Math.PI * 2, theta = v / hs * thetaLength;
    return [-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta)];
  };
  for (let v = 0; v < hs; v++) {
    for (let u = 0; u < ws; u++) {
      const a = at(u, v), b = at(u + 1, v), c = at(u + 1, v + 1), d = at(u, v + 1);
      const n = function (p) { return smooth ? norm(p) : null; };
      if (v > 0) outward(out, a, d, b, n(a), n(d), n(b));
      outward(out, b, d, c, n(b), n(d), n(c));
    }
  }
  return out;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_V = [-1, PHI, 0, 1, PHI, 0, -1, -PHI, 0, 1, -PHI, 0, 0, -1, PHI, 0, 1, PHI, 0, -1, -PHI, 0, 1, -PHI, PHI, 0, -1, PHI, 0, 1, -PHI, 0, -1, -PHI, 0, 1];
const ICO_F = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
  3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
const IR = 1 / PHI;
const DOD_V = [-1, -1, -1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, -1, -1, 1, -1, 1, 1, 1, -1, 1, 1, 1,
  0, -IR, -PHI, 0, -IR, PHI, 0, IR, -PHI, 0, IR, PHI, -IR, -PHI, 0, -IR, PHI, 0, IR, -PHI, 0, IR, PHI, 0,
  -PHI, 0, -IR, PHI, 0, -IR, -PHI, 0, IR, PHI, 0, IR];
const DOD_F = [3, 11, 7, 3, 7, 15, 3, 15, 13, 7, 19, 17, 7, 17, 6, 7, 6, 15, 17, 4, 8, 17, 8, 10, 17, 10, 6,
  8, 0, 16, 8, 16, 2, 8, 2, 10, 0, 12, 1, 0, 1, 18, 0, 18, 16, 6, 10, 2, 6, 2, 13, 6, 13, 15,
  2, 16, 18, 2, 18, 3, 2, 3, 13, 18, 1, 9, 18, 9, 11, 18, 11, 3, 4, 14, 12, 4, 12, 0, 4, 0, 8,
  11, 9, 5, 11, 5, 19, 11, 19, 7, 19, 5, 14, 19, 14, 4, 19, 4, 17, 1, 12, 14, 1, 14, 5, 1, 5, 9];
function polyhedron(V, F, r) {
  const pts = [];
  for (let i = 0; i < V.length; i += 3) {
    const n = norm([V[i], V[i + 1], V[i + 2]]);
    pts.push([n[0] * r, n[1] * r, n[2] * r]);
  }
  const out = [];
  for (let i = 0; i < F.length; i += 3) outward(out, pts[F[i]], pts[F[i + 1]], pts[F[i + 2]]);
  return out;
}
export function icosahedron(r) { return polyhedron(ICO_V, ICO_F, r); }
export function dodecahedron(r) { return polyhedron(DOD_V, DOD_F, r); }
// For the tests: the faces of each, to prove each is a face of the hull.
export const POLYHEDRA = { icosahedron: [ICO_V, ICO_F], dodecahedron: [DOD_V, DOD_F] };

export function box(w, h, d) {
  const out = [];
  const x = w / 2, y = h / 2, z = d / 2;
  const c = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
  faces.forEach(function (f) {
    outward(out, c[f[0]], c[f[1]], c[f[2]]);
    outward(out, c[f[0]], c[f[2]], c[f[3]]);
  });
  return out;
}

// A ring in the XY plane, like three's TorusGeometry; normals point away
// from the tube's centre line.
export function torus(R, tube, radialSeg, tubularSeg) {
  const out = [];
  const at = function (j, i) {
    const u = i / tubularSeg * Math.PI * 2, v = j / radialSeg * Math.PI * 2;
    const p = [(R + tube * Math.cos(v)) * Math.cos(u), (R + tube * Math.cos(v)) * Math.sin(u), tube * Math.sin(v)];
    const c = [R * Math.cos(u), R * Math.sin(u), 0];
    return { p: p, n: norm(sub(p, c)) };
  };
  for (let j = 0; j < radialSeg; j++) {
    for (let i = 0; i < tubularSeg; i++) {
      const a = at(j, i), b = at(j + 1, i), c = at(j + 1, i + 1), d = at(j, i + 1);
      const tri = function (p, q, s) {
        const n = cross(sub(q.p, p.p), sub(s.p, p.p));
        if (dot(n, p.n) < 0) out.push({ p: [p.p, s.p, q.p], n: [p.n, s.n, q.n] });
        else out.push({ p: [p.p, q.p, s.p], n: [p.n, q.n, s.n] });
      };
      tri(a, b, d);
      tri(b, c, d);
    }
  }
  return out;
}

// One flat triangle, seen from both sides (a bird's wing).
export function wing(a, b, c) {
  const n = norm(cross(sub(b, a), sub(c, a)));
  const m = [-n[0], -n[1], -n[2]];
  return [{ p: [a, b, c], n: [n, n, n] }, { p: [a, c, b], n: [m, m, m] }];
}

// A w by h rectangle facing +z, seen from both sides (a flag).
export function card(w, h) {
  const x = w / 2, y = h / 2;
  const f = [0, 0, 1], k = [0, 0, -1];
  const a = [-x, -y, 0], b = [x, -y, 0], c = [x, y, 0], d = [-x, y, 0];
  return [{ p: [a, b, c], n: [f, f, f] }, { p: [a, c, d], n: [f, f, f] },
          { p: [a, c, b], n: [k, k, k] }, { p: [a, d, c], n: [k, k, k] }];
}

// ---- Joining parts. Returns { vertices: Float32Array, count }.
function transformPoint(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
          m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
          m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}
// Normals take the inverse transpose; for rotation with scale that is the
// rotation with the scale divided out, so scaling by its inverse squared works.
function transformNormal(m, n) {
  const sx2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2];
  const sy2 = m[4] * m[4] + m[5] * m[5] + m[6] * m[6];
  const sz2 = m[8] * m[8] + m[9] * m[9] + m[10] * m[10];
  const v = [n[0] / sx2, n[1] / sy2, n[2] / sz2];
  return norm([m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
               m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
               m[2] * v[0] + m[6] * v[1] + m[10] * v[2]]);
}

export function countVertices(parts) {
  let n = 0;
  for (let i = 0; i < parts.length; i++) n += parts[i].tris.length * 3;
  return n;
}

// Writes parts into `into` (a Float32Array) from vertex `at`, each part
// moved by `outer` (a matrix) as well as its own. Returns the next vertex.
export function write(into, at, parts, outer) {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const m = outer ? (part.matrix ? multiply(outer, part.matrix) : outer) : (part.matrix || matrix());
    const col = part.color ? linear(part.color) : [1, 1, 1];
    const alpha = part.alpha === undefined ? 1 : part.alpha;
    for (let t = 0; t < part.tris.length; t++) {
      const tri = part.tris[t];
      for (let v = 0; v < 3; v++) {
        const p = transformPoint(m, tri.p[v]), n = transformNormal(m, tri.n[v]);
        const o = at * STRIDE;
        into[o] = p[0]; into[o + 1] = p[1]; into[o + 2] = p[2];
        into[o + 3] = n[0]; into[o + 4] = n[1]; into[o + 5] = n[2];
        into[o + 6] = 0; into[o + 7] = 0;
        into[o + 8] = col[0]; into[o + 9] = col[1]; into[o + 10] = col[2]; into[o + 11] = alpha;
        at++;
      }
    }
  }
  return at;
}

export function merge(parts) {
  const count = countVertices(parts);
  const vertices = new Float32Array(count * STRIDE);
  write(vertices, 0, parts, null);
  return { vertices: vertices, count: count };
}

// The same parts stamped at many places (a whole stand of pines), each
// placement a matrix. One array for the lot, so it draws in one go.
export function stamp(parts, placements) {
  const per = countVertices(parts);
  const vertices = new Float32Array(per * placements.length * STRIDE);
  let at = 0;
  for (let i = 0; i < placements.length; i++) at = write(vertices, at, parts, placements[i]);
  return { vertices: vertices, count: at };
}
