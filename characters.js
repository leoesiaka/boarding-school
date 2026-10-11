/* characters.js — Unity Heights human character builder + animation
 * ---------------------------------------------------------------------------
 * Builds realistic-proportion, low-poly humans (boys, girls, men, women) with
 * proper anatomy (neck, jaw, nose, lips, ears, hands, fingers, shoes), Nigerian
 * school uniforms and staff outfits, hairstyles (low cut, curls, twists,
 * cornrows, braids, puffs, afro, bun), head ties and hijabs.
 *
 * Every body part is baked into a handful of merged meshes per bone, so a
 * classroom full of people costs far fewer draw calls than before.
 *
 * Rig (all rotations in radians, character faces -Z):
 *   root → spine → head / armL,armR → elbowL,elbowR
 *   root → hipL,hipR → kneeL,kneeR
 *
 * Public API (window.UHHumans):
 *   create(cfg)            → THREE.Group  (outer group; game sets x/z/rotation.y)
 *   update(h, dt, opts)    → drives walking / sitting / teaching poses
 *   sitHipY                → default seat-height used for seated poses
 */
(function (root) {
  'use strict';
  let T = root.THREE;
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // ---------- small utilities ------------------------------------------------
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hex(c) { if (typeof c === 'number') return c; return new T.Color(c).getHex(); }
  function mix(a, b, k) { const A = new T.Color(hex(a)), B = new T.Color(hex(b)); A.lerp(B, k); return A.getHex(); }
  function shade(c, f) { const A = new T.Color(hex(c)); A.r = Math.min(1, A.r * f); A.g = Math.min(1, A.g * f); A.b = Math.min(1, A.b * f); return A.getHex(); }

  // ---------- materials (shared between all humans) -------------------------
  const MATS = new Map();
  function M(color, rough, o) {
    o = o || {}; rough = rough === undefined ? .85 : rough;
    const key = hex(color) + '|' + rough + '|' + (o.flat ? 1 : 0) + '|' + (o.dbl ? 1 : 0) + '|' + (o.metal || 0) + '|' + (o.pat || '');
    let m = MATS.get(key);
    if (!m) {
      const p = { color: hex(color), roughness: rough, metalness: o.metal || 0 };
      if (o.flat) p.flatShading = true;
      if (o.dbl) p.side = T.DoubleSide;
      if (o.map) p.map = o.map;
      m = new T.MeshStandardMaterial(p); MATS.set(key, m);
    }
    return m;
  }
  const PATTERNS = new Map();
  // Ankara-style wax-print cloth, drawn once on a small canvas
  function ankaraMat(base, a1, a2) {
    const key = 'ank|' + hex(base) + '|' + hex(a1) + '|' + hex(a2);
    if (typeof document === 'undefined') return M(base, .9);
    let tex = PATTERNS.get(key);
    if (!tex) {
      const css = (c) => '#' + ('000000' + hex(c).toString(16)).slice(-6);
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = css(base); g.fillRect(0, 0, 64, 64);
      g.fillStyle = css(a1);
      for (const [x, y] of [[16, 16], [48, 48]]) { g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 9, y); g.lineTo(x, y + 12); g.lineTo(x - 9, y); g.closePath(); g.fill(); }
      g.fillStyle = css(a2);
      for (const [x, y] of [[48, 16], [16, 48]]) { g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); g.fillStyle = css(base); g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); g.fillStyle = css(a2); }
      g.strokeStyle = css(a1); g.lineWidth = 2; g.beginPath(); g.moveTo(0, 32); g.lineTo(64, 32); g.moveTo(32, 0); g.lineTo(32, 64); g.stroke();
      tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(3, 2); PATTERNS.set(key, tex);
    }
    return M(base, .9, { map: tex, pat: key });
  }

  // ---------- primitive geometry cache (unit shapes, baked per part) --------
  const GEO = Object.create(null);
  function gSphere(seg) { const k = 's' + seg; return GEO[k] || (GEO[k] = new T.SphereGeometry(1, seg, Math.max(5, Math.round(seg * .7)))); }
  function gBox() { return GEO.b || (GEO.b = new T.BoxGeometry(1, 1, 1)); }
  function gCyl(rt, rb, seg, open, ts, tl) { const k = ['c', rt, rb, seg, open ? 1 : 0, ts || 0, tl || ''].join('|'); return GEO[k] || (GEO[k] = new T.CylinderGeometry(rt, rb, 1, seg, 1, !!open, ts || 0, tl || TAU)); }
  function gTorus(r, tube, rs, ts) { const k = ['t', r, tube, rs, ts].join('|'); return GEO[k] || (GEO[k] = new T.TorusGeometry(r, tube, rs, ts)); }
  function gCapBack(L) { const k = 'capb|' + L; return GEO[k] || (GEO[k] = new T.SphereGeometry(1, 18, 10, -.4, Math.PI + .8, 0, L)); }
  function gCap(L, tilt) {
    const k = 'cap|' + L + '|' + tilt; if (GEO[k]) return GEO[k];
    const g = new T.SphereGeometry(1, 18, 10, 0, TAU, 0, L); g.rotateX(tilt); return (GEO[k] = g);
  }

  // ---------- merged-geometry builder ---------------------------------------
  function Builder() {
    const bones = {};
    const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpE = new T.Euler(), tmpP = new T.Vector3(), tmpS = new T.Vector3();
    const B = {
      bones,
      bone(name, parent, px, py, pz) {
        const group = new T.Group(); group.name = name;
        const pp = parent ? bones[parent].pivot : [0, 0, 0];
        group.position.set(px - pp[0], py - pp[1], pz - pp[2]);
        if (parent) bones[parent].group.add(group);
        bones[name] = { group, pivot: [px, py, pz], parts: [] };
        return bones[name];
      },
      part(bone, geo, material, x, y, z, sx, sy, sz, o) {
        o = o || {}; const b = bones[bone];
        tmpP.set(x - b.pivot[0], y - b.pivot[1], z - b.pivot[2]);
        if (o.q) tmpQ.copy(o.q); else { tmpE.set(o.rx || 0, o.ry || 0, o.rz || 0); tmpQ.setFromEuler(tmpE); }
        tmpS.set(sx, sy, sz); tmpM.compose(tmpP, tmpQ, tmpS);
        b.parts.push({ geo: geo.clone().applyMatrix4(tmpM), material });
      },
      ell(bone, mat, rx, ry, rz, x, y, z, o) { B.part(bone, gSphere((o && o.seg) || 12), mat, x, y, z, rx, ry, rz, o); },
      box(bone, mat, w, h, d, x, y, z, o) { B.part(bone, gBox(), mat, x, y, z, w, h, d, o); },
      cyl(bone, mat, rt, rb, h, x, y, z, o) { o = o || {}; B.part(bone, gCyl(rt, rb, o.seg || 10, o.open, o.ts, o.tl), mat, x, y, z, o.sx || 1, h, o.sz || 1, o); },
      torus(bone, mat, r, tube, x, y, z, o) { o = o || {}; B.part(bone, gTorus(r, tube, o.rs || 6, o.ts || 14), mat, x, y, z, o.sx || 1, o.sy || 1, o.sz || 1, o); },
      cap(bone, mat, rx, ry, rz, x, y, z, L, tilt) { B.part(bone, gCap(L, tilt), mat, x, y, z, rx, ry, rz); },
      // surface of revolution; points are [radius, y] in rig (standing) coordinates
      lathe(bone, mat, pts, sx, sz, seg) {
        // LatheGeometry faces point outward only when the profile runs bottom → top
        const ordered = pts.slice().sort((a, b) => a[1] - b[1]);
        const g = new T.LatheGeometry(ordered.map(p => new T.Vector2(p[0], p[1])), seg || 14);
        B.part(bone, g, mat, 0, 0, 0, sx, 1, sz);
      },
      flush() {
        for (const name in bones) {
          const b = bones[name]; const byMat = new Map();
          for (const p of b.parts) { if (!byMat.has(p.material)) byMat.set(p.material, []); byMat.get(p.material).push(p.geo); }
          for (const [material, list] of byMat) {
            const ngs = list.map(g => g.index ? g.toNonIndexed() : g);
            let n = 0; for (const g of ngs) n += g.attributes.position.count;
            const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
            let o = 0;
            for (const g of ngs) {
              pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
              if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
              o += g.attributes.position.count;
            }
            const out = new T.BufferGeometry();
            out.setAttribute('position', new T.BufferAttribute(pos, 3));
            out.setAttribute('normal', new T.BufferAttribute(nor, 3));
            out.setAttribute('uv', new T.BufferAttribute(uv, 2));
            const mesh = new T.Mesh(out, material); mesh.castShadow = true; mesh.receiveShadow = true;
            b.group.add(mesh);
          }
          b.parts.length = 0;
        }
      }
    };
    return B;
  }

  // ---------- skull constants (rig units, standing) --------------------------
  const CY = 1.77, HX = .092, HY = .135, HZ = .108;
  const HIP_Y = .94, KNEE_Y = .50, SHOULDER_Y = 1.46, ELBOW_Y = 1.16;
  const THIGH = .44, SHIN = .41, FOOT_H = .085;
  const SEAT_HIP = .615; // world height of the hip joint on a standard classroom seat

  // points distributed on a unit sphere cap (golden spiral), used for hair
  function capPoints(n, maxTheta, tilt, minTheta) {
    const pts = []; const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const u = (i + .5) / n; const th = (minTheta || 0) + Math.acos(1 - u * (1 - Math.cos(maxTheta - (minTheta || 0)))) ; const ph = i * ga;
      let x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      const c = Math.cos(tilt), s = Math.sin(tilt); const y2 = y * c - z * s, z2 = y * s + z * c;
      pts.push([x, y2, z2]);
    }
    return pts;
  }

  // ===========================================================================
  //  CREATE
  // ===========================================================================
  function create(cfg) {
    cfg = cfg || {};
    const R = rng(hashStr(String(cfg.seed || cfg.name || 'anon')));
    const female = cfg.gender ? cfg.gender === 'f' : !!(cfg.female || cfg.skirt || cfg.adultFemale);
    const adult = !!cfg.adult;
    const bw = cfg.build === 'slim' ? .93 : cfg.build === 'stocky' ? 1.1 : 1;
    let s = cfg.height || (adult ? (female ? .955 : 1) : (female ? .86 : .89));
    s *= 1 + (R() - .5) * (adult ? .04 : .07);
    const lk = (adult ? 1 : .92) * bw;                  // limb thickness
    const sxJ = (female ? .232 : .268) * (adult ? 1 : .96) * (bw > 1 ? 1.04 : 1);  // shoulder joint x
    const hipX = female ? .108 : .1;

    // palette --------------------------------------------------------------
    const skinC = hex(cfg.skin || '#603b2b');
    const skin = M(skinC, .78), skinDark = M(shade(skinC, .78), .85);
    const lipC = mix(skinC, 0x6a2a2c, .5), lips = M(lipC, .7), mouthM = M(0x3a1c1a, .9);
    const hairC = hex(cfg.hairColor || 0x14110f);
    const grey = !!cfg.grey;
    const hairM = M(hairC, .95), greyM = M(mix(hairC, 0x9a9890, .55), .95);
    const white = M(0xefe9dd, .55), iris = M(0x2a1a12, .45), black = M(0x0c0b0b, .5);
    const shirtC = hex(cfg.shirt || 0xf0eee6);
    const shirt = M(shirtC, .86), shirtShade = M(shade(shirtC, .86), .86);
    const bottomKind = cfg.bottom || (female && cfg.skirt !== false && (cfg.skirt || cfg.adultFemale || cfg.gender === 'f' || cfg.female) ? 'skirt' : 'trousers');
    const pantsC = hex(cfg.pants || 0x233c57);
    const pants = M(pantsC, .88), pantsDark = M(shade(pantsC, .78), .88);
    const skirtM = cfg.skirtPattern ? ankaraMat(cfg.skirtPattern[0], cfg.skirtPattern[1], cfg.skirtPattern[2]) : M(pantsC, .88, { flat: true });
    const shoeM = M(cfg.shoes || 0x1d2226, .6), sole = M(0x0d0d0d, .9);
    const sockM = M(cfg.socks || 0xf4f2ea, .9);
    const tieM = M(cfg.tie || 0x7b3439, .7);
    const gold = M(0xd6b15c, .45, { metal: .3 });
    const sleeves = cfg.sleeves || (adult ? 'rolled' : 'short');
    const showTie = cfg.necktie !== false && !(adult && female) && !cfg.labCoat && !cfg.apron;

    const B = Builder();
    B.bone('root', null, 0, 0, 0);
    B.bone('hipL', 'root', -hipX, HIP_Y, 0); B.bone('hipR', 'root', hipX, HIP_Y, 0);
    B.bone('kneeL', 'hipL', -hipX, KNEE_Y, 0); B.bone('kneeR', 'hipR', hipX, KNEE_Y, 0);
    B.bone('spine', 'root', 0, 1.0, 0);
    B.bone('head', 'spine', 0, 1.56, 0);
    B.bone('armL', 'spine', -sxJ, SHOULDER_Y, 0); B.bone('armR', 'spine', sxJ, SHOULDER_Y, 0);
    B.bone('elbowL', 'armL', -sxJ, ELBOW_Y, 0); B.bone('elbowR', 'armR', sxJ, ELBOW_Y, 0);

    // ---- legs ------------------------------------------------------------
    for (const side of [-1, 1]) {
      const hn = side < 0 ? 'hipL' : 'hipR', kn = side < 0 ? 'kneeL' : 'kneeR', x = side * hipX;
      const tR = .084 * lk, tB = .064 * lk;
      B.ell(hn, bottomKind === 'skirt' ? skirtM : pants, .086 * lk, .09 * lk, .09 * lk, x, HIP_Y - .02, 0, { seg: 10 });
      if (bottomKind === 'trousers') {
        B.cyl(hn, pants, tR, tB, THIGH, x, HIP_Y - THIGH / 2, 0, { seg: 10, sx: 1, sz: 1.04 });
        B.ell(kn, pants, .06 * lk, .06 * lk, .064 * lk, x, KNEE_Y, 0, { seg: 9 });
        B.cyl(kn, pants, .062 * lk, .047 * lk, SHIN, x, KNEE_Y - SHIN / 2, 0, { seg: 10 });
        B.cyl(kn, pantsDark, .046 * lk, .047 * lk, .03, x, .115, 0, { seg: 10 }); // trouser cuff
      } else {
        const cover = bottomKind === 'skirt' ? .3 : .27;            // skirt / shorts length down the thigh
        const cm = bottomKind === 'skirt' ? skirtM : pants;
        B.cyl(hn, skin, tB + .004, tB, THIGH, x, HIP_Y - THIGH / 2, 0, { seg: 10 });
        B.cyl(hn, cm, tR + .006, tR - .006, cover, x, HIP_Y - cover / 2, 0, { seg: 10, sx: 1, sz: 1.04 });
        B.ell(kn, skin, .054 * lk, .054 * lk, .058 * lk, x, KNEE_Y, 0, { seg: 9 });
        B.cyl(kn, skin, .058 * lk, .041 * lk, SHIN, x, KNEE_Y - SHIN / 2, 0, { seg: 10 });
        if (cfg.socks !== false) B.cyl(kn, sockM, .043 * lk, .041 * lk, .2, x, .2, 0, { seg: 10 });
      }
      // shoe: heel block, toe box and sole
      B.box(kn, shoeM, .092, .06, .17, x, .05, -.035);
      B.ell(kn, shoeM, .05, .037, .078, x, .046, -.115, { seg: 10 });
      B.ell(kn, shoeM, .047, .04, .045, x, .075, -.005, { seg: 8 });
      B.box(kn, sole, .1, .016, .29, x, .009, -.065);
    }

    // ---- lower garment / pelvis (root) -------------------------------------
    const hs = female ? 1.38 : 1.25, hz = female ? .84 : .8;
    if (bottomKind === 'skirt') {
      const hem = cfg.skirtLen === 'long' ? .36 : .6;
      B.lathe('root', skirtM, [[.122, 1.08], [.146, 1.0], [.162, .88], [.18, (1.0 + hem) / 2 + .1], [.198, hem]], female ? 1.2 : 1.15, .98, 16);
      B.lathe('root', M(shade(pantsC, .8), .9), [[.12, 1.085], [.123, 1.07]], 1.25, .98, 16);
      B.lathe('root', skirtM, [[.118, 1.1], [.122, 1.08]], 1.25, .98, 16);
    } else {
      B.lathe('root', pants, [[.15, .86], [.162, .93], [.159, 1.0], [.146, 1.04]], hs, hz, 14);
      B.lathe('root', M(0x17120f, .6), [[.1585 * 1.0, .995], [.1585, 1.03]], hs * 1.006, hz * 1.006, 14); // belt
      B.box('root', gold, .045, .032, .01, 0, 1.012, -.158 * hz * 1.0 - .004);
    }

    // ---- torso (spine) -----------------------------------------------------
    const tk = adult ? 1 : .95;
    const sleeveYoke = () => (cfg.labCoat ? M(0xf3f1ea, .85) : (cfg.blazer || cfg.cardigan) ? M(cfg.blazer || cfg.cardigan, .85) : shirt);
    const trunk = female
      ? [[.135, .98], [.126, 1.06], [.12, 1.14], [.13, 1.24], [.142, 1.33], [.14, 1.4], [.128, 1.45], [.1, 1.49], [.06, 1.54]]
      : [[.14, .98], [.146, 1.06], [.15, 1.18], [.164, 1.3], [.17, 1.38], [.158, 1.45], [.115, 1.5], [.062, 1.54]];
    const tpts = trunk.map(p => [p[0] * tk * bw, p[1]]);
    const tsx = female ? 1.16 : 1.28, tsz = female ? .82 : .76;
    B.lathe('spine', shirt, tpts, tsx, tsz, 14);
    if (female && adult) { const bs = .85; for (const sd of [-1, 1]) B.ell('spine', shirt, .056 * bs, .05 * bs, .05 * bs, sd * .058, 1.33, -.108 * tsz / .82, { seg: 9 }); }
    B.ell('spine', sleeveYoke(), sxJ * .93, .046, .078 * (tsz / .76), 0, 1.452, 0, { seg: 12 });
    // collar, buttons, placket
    B.torus('spine', cfg.collar ? M(cfg.collar, .8) : M(shade(shirtC, 1.04), .7), .06, .014, 0, 1.52, -.004, { rx: Math.PI / 2, sx: 1.12, sy: .95, sz: 1, rs: 6, ts: 14 });
    for (const sd of [-1, 1]) B.part('spine', gCyl(0, .035, 3, false), shirt, sd * .05, 1.495, -.092, 1, .075, .4, { rz: sd * .35, rx: Math.PI });
    for (let i = 0; i < 4; i++) B.ell('spine', M(0x5c5e58), .009, .009, .006, 0, 1.36 - i * .1, -(.17 * tsz) * 0.965 - .004, { seg: 6 });

    // tie, crest, lanyard
    if (showTie) {
      B.ell('spine', tieM, .024, .02, .016, 0, 1.487, -.123 * (tsz / .76), { seg: 7 });
      B.box('spine', tieM, .05, .28, .011, 0, 1.345, -.135 * (tsz / .76));
      B.part('spine', gCyl(0, .027, 4, false), tieM, 0, 1.2, -.136 * (tsz / .76), 1, .05, .4, { rx: Math.PI });
    }
    if (!adult || cfg.crest) {
      B.box('spine', gold, .066, .066, .012, .1, 1.28, -.128 * (tsz / .76));
      B.box('spine', M(cfg.crestColor || 0x345d41), .04, .04, .014, .1, 1.28, -.133 * (tsz / .76));
    }
    if (cfg.lanyard) {
      B.box('spine', M(cfg.lanyard, .7), .018, .3, .008, -.04, 1.33, -.135 * (tsz / .76), { rz: -.2 });
      B.box('spine', M(cfg.lanyard, .7), .018, .3, .008, .04, 1.33, -.135 * (tsz / .76), { rz: .2 });
      B.box('spine', M(0xf4f1e6, .6), .055, .08, .008, 0, 1.15, -.14 * (tsz / .76));
    }
    if (cfg.sash) { B.box('spine', M(cfg.sash, .7), .06, .6, .01, 0, 1.28, -.139 * (tsz / .76), { rz: .6 }); }
    if (cfg.apron) {
      B.box('spine', M(cfg.apron, .9), .3, .5, .012, 0, 1.14, -.142 * (tsz / .76));
      B.box('spine', M(cfg.apron, .9), .04, .3, .01, -.1, 1.38, -.13, { rz: .3 }); B.box('spine', M(cfg.apron, .9), .04, .3, .01, .1, 1.38, -.13, { rz: -.3 });
    }
    if (cfg.stethoscope) {
      B.torus('spine', M(0x2b3236, .5), .07, .008, 0, 1.46, -.08, { rx: Math.PI / 2 - .5, sx: 1, sy: 1.1, rs: 5, ts: 14 });
      B.ell('spine', M(0xb9c1c4, .4, { metal: .5 }), .02, .02, .008, .035, 1.18, -.142, { seg: 8 });
    }
    // lab coat (long white coat) / blazer / cardigan layers
    if (cfg.labCoat || cfg.blazer || cfg.cardigan) {
      const cc = M(cfg.labCoat ? 0xf3f1ea : (cfg.blazer || cfg.cardigan), .85);
      const grow = 1.1;
      B.lathe('spine', cc, trunk.map(p => [p[0] * tk * bw * grow + .006, p[1]]).slice(0, 7), tsx, tsz + .02, 16);
      if (cfg.labCoat) {
        B.lathe('root', cc, [[.17, 1.0], [.185, .86], [.2, .7], [.205, .56]], 1.3, 1.05, 16);
        for (const sd of [-1, 1]) B.box('spine', M(0xdedbd2, .85), .09, .03, .01, sd * .1, 1.12, -.16 * (tsz / .76) - .02);
      }
      for (const sd of [-1, 1]) B.part('spine', gCyl(0, .05, 3, false), M(shade(cc.color.getHex(), .9), .8), sd * .055, 1.42, -.14 * (tsz / .76), 1, .2, .25, { rz: sd * .4, rx: Math.PI });
    }
    // ---- backpack (students) ------------------------------------------------
    if (cfg.backpack) {
      const bag = M(cfg.bagColor || 0x354e65, .8);
      B.box('spine', bag, .3, .38, .15, 0, 1.2, .17);
      B.box('spine', M(0x876a43, .8), .24, .12, .03, 0, 1.12, .255);
      for (const sd of [-1, 1]) { B.box('spine', M(0x2d2f30, .9), .035, .36, .012, sd * .1, 1.32, -.11 * (tsz / .76), { rx: .1 }); B.box('spine', M(0x2d2f30, .9), .035, .02, .3, sd * .1, 1.5, .02); }
    }

    // ---- neck & head -----------------------------------------------------------
    B.cyl('head', skin, .048, .054, .14, 0, 1.585, .006, { seg: 10 });
    const skull = [HX, HY, HZ];
    B.ell('head', skin, HX, HY, HZ, 0, CY, 0, { seg: 18 });
    B.ell('head', skin, .074, .062, .084, 0, CY - .088, -.022, { seg: 14 });          // jaw & chin
    B.ell('head', skin, .05, .034, .036, 0, CY - .066, -.07, { seg: 10 });            // mouth area
    for (const sd of [-1, 1]) B.ell('head', skin, .022, .027, .02, sd * .057, CY - .036, -.07, { seg: 8 }); // cheekbones
    // eyes, lids, brows
    for (const sd of [-1, 1]) {
      const x = sd * .041;
      B.ell('head', white, .0215, .0125, .01, x, CY + .008, -.0925, { seg: 10 });
      B.ell('head', iris, .0108, .0115, .006, x, CY + .008, -.1005, { seg: 8 });
      B.ell('head', black, .0055, .006, .004, x, CY + .008, -.1048, { seg: 6 });
      B.ell('head', skinDark, .0245, .0052, .0115, x, CY + .0195, -.0915, { seg: 8 });
      B.ell('head', hairM, female ? .03 : .033, female ? .0045 : .0062, .009, x, CY + (female ? .046 : .043), -.0905, { rz: -sd * .05, seg: 8 });
    }
    // nose
    B.ell('head', skin, .0125, .032, .016, 0, CY - .005, -.1055, { seg: 9 });
    B.ell('head', skin, .0205, .0165, .021, 0, CY - .035, -.1265, { seg: 10 });
    for (const sd of [-1, 1]) { B.ell('head', skin, .0135, .0145, .0155, sd * .0225, CY - .036, -.1175, { seg: 8 }); B.ell('head', black, .006, .004, .006, sd * .0115, CY - .0455, -.1335, { seg: 6 }); }
    // lips
    B.ell('head', lips, .0265, .0085, .011, 0, CY - .0625, -.103, { seg: 10 });
    B.ell('head', lips, .0235, .0095, .0115, 0, CY - .0775, -.1005, { seg: 10 });
    B.ell('head', mouthM, .02, .002, .006, 0, CY - .0705, -.1075, { seg: 6 });
    // ears
    const covered = !!cfg.headcover;
    if (!covered) for (const sd of [-1, 1]) { B.ell('head', skin, .012, .029, .019, sd * (HX + .002), CY - .004, .006, { seg: 8 }); B.ell('head', skinDark, .006, .018, .01, sd * (HX + .009), CY - .004, .004, { seg: 6 }); }
    // glasses
    if (cfg.glasses) {
      const gm = M(0x252b2e, .4, { metal: .5 });
      for (const sd of [-1, 1]) { B.torus('head', gm, .0285, .0042, sd * .041, CY + .008, -.105, { rs: 4, ts: 14 }); B.box('head', gm, .005, .005, .1, sd * .085, CY + .012, -.045); }
      B.box('head', gm, .02, .005, .005, 0, CY + .014, -.108);
    }
    // facial hair
    if (cfg.beard || cfg.moustache || cfg.goatee) {
      const fh = grey ? greyM : hairM;
      B.ell('head', fh, .04, .008, .014, 0, CY - .053, -.107, { seg: 8 });
      if (cfg.beard) { B.ell('head', fh, .074, .052, .072, 0, CY - .098, -.03, { seg: 12 }); B.ell('head', fh, .05, .03, .04, 0, CY - .085, -.07, { seg: 10 }); }
      else if (cfg.goatee) B.ell('head', fh, .03, .035, .025, 0, CY - .115, -.085, { seg: 9 });
    }

    // ---- hair / head coverings ---------------------------------------------------
    const hm = hairM;
    function bumpsOnCap(n, maxTheta, tilt, k, size, mat) {
      for (const p of capPoints(n, maxTheta, tilt)) B.ell('head', mat || hm, size, size, size, p[0] * HX * k, CY + p[1] * HY * k, p[2] * HZ * k, { seg: 6 });
    }
    const style = cfg.hairStyle || 'low';
    if (cfg.headcover === 'hijab') {
      const cloth = M(cfg.hijab || 0xeeeeea, .9, { dbl: true });
      B.cap('head', cloth, HX * 1.12, HY * 1.09, HZ * 1.12, 0, CY, .004, 1.56, .58);
      B.part('head', gCapBack(2.0), cloth, 0, CY, .008, HX * 1.12, HY * 1.1, HZ * 1.12);   // sides + back, face stays open
      B.cyl('head', cloth, .072, .09, .11, 0, 1.575, .016, { seg: 12, sz: 1.05 });
      B.lathe('spine', cloth, [[.1, 1.6], [.125, 1.52], [.165, 1.43], [.185, 1.34], [.19, 1.27]], 1.2, .92, 14);
    } else if (cfg.headcover === 'headtie') {
      const ht = cfg.headtiePattern ? ankaraMat(cfg.headtiePattern[0], cfg.headtiePattern[1], cfg.headtiePattern[2]) : M(cfg.headtie || 0xb5513a, .85);
      B.cap('head', ht, HX * 1.12, HY * 1.1, HZ * 1.12, 0, CY, .006, 1.5, .5);
      B.ell('head', ht, .075, .045, .07, -.01, CY + .125, -.01, { seg: 10 });
      B.ell('head', ht, .05, .042, .06, .05, CY + .148, .008, { seg: 9, rz: -.4 });
      B.ell('head', ht, .035, .06, .035, .085, CY + .11, .02, { seg: 8, rz: -.8 });
      B.ell('head', ht, .06, .02, .05, 0, CY + .075, -.075, { seg: 8 });
    } else {
      switch (style) {
        case 'bald': break;
        case 'curly':
          B.cap('head', hm, HX * 1.08, HY * 1.06, HZ * 1.08, 0, CY, .003, 1.56, .54);
          bumpsOnCap(32, 1.5, .5, 1.1, .024); break;
        case 'afro':
          B.cap('head', hm, HX * 1.16, HY * 1.12, HZ * 1.16, 0, CY + .01, .004, 1.7, .46);
          bumpsOnCap(44, 1.6, .46, 1.22, .034); break;
        case 'twists': {
          B.cap('head', hm, HX * 1.05, HY * 1.04, HZ * 1.05, 0, CY, .003, 1.56, .54);
          const up = new T.Vector3(0, 1, 0);
          for (const p of capPoints(40, 1.3, .52, .2)) {
            const n0 = new T.Vector3(p[0], p[1], p[2]).normalize();
            const n = new T.Vector3(n0.x * .55, n0.y * .55 + .6, n0.z * .55).normalize(); const q = new T.Quaternion().setFromUnitVectors(up, n);
            B.cyl('head', hm, .008, .012, .07, p[0] * HX * 1.07 + n.x * .028, CY + p[1] * HY * 1.07 + n.y * .028, p[2] * HZ * 1.07 + n.z * .028, { seg: 5, q });
          }
          break;
        }
        case 'cornrows': {
          B.cap('head', hm, HX * 1.035, HY * 1.03, HZ * 1.035, 0, CY, .003, 1.56, .56);
          for (let i = -3; i <= 3; i++) {
            const a = i * .21;
            for (let j = 0; j < 8; j++) {
              const psi = 1.0 - j * .27; const cx = Math.sin(a), cy = Math.cos(a) * Math.cos(psi), cz = -Math.cos(a) * Math.sin(psi);
              B.ell('head', hm, .0105, .0105, .0105, cx * HX * 1.06, CY + cy * HY * 1.06, cz * HZ * 1.06, { seg: 6 });
            }
          }
          break;
        }
        case 'braids': {
          B.cap('head', hm, HX * 1.06, HY * 1.04, HZ * 1.06, 0, CY, .003, 1.56, .54);
          for (let i = 0; i < 18; i++) {
            const a = (-.92 + i / 17 * 1.84) * Math.PI; const row = i % 2;
            const px = Math.sin(a) * HX * 1.05, pz = Math.cos(a) * HZ * 1.0 + (row ? .02 : 0);
            if (pz < -.03) continue;
            B.cyl('head', hm, .013, .007, .34 + row * .06, px * 1.02, CY - .02 - (.34 + row * .06) / 2 + .06, pz + .012, { seg: 5, rx: pz > 0 ? -.05 : 0 });
          }
          break;
        }
        case 'puffs':
          B.cap('head', hm, HX * 1.04, HY * 1.03, HZ * 1.04, 0, CY, .003, 1.5, .56);
          for (const sd of [-1, 1]) { B.ell('head', hm, .058, .052, .054, sd * .066, CY + .125, .012, { seg: 10 }); B.torus('head', M(0xc9a24a, .7), .03, .009, sd * .06, CY + .1, .012, { rz: sd * .5, rs: 4, ts: 10 }); }
          break;
        case 'bun':
          B.cap('head', hm, HX * 1.045, HY * 1.04, HZ * 1.045, 0, CY, .003, 1.56, .56);
          B.ell('head', hm, .05, .045, .05, 0, CY + .155, .045, { seg: 10 }); B.torus('head', M(0xb5513a, .7), .035, .008, 0, CY + .125, .04, { rx: Math.PI / 2 + .5, rs: 4, ts: 10 });
          break;
        case 'fade':
        case 'low':
        default: {
          const k = style === 'fade' ? 1.03 : 1.045;
          B.cap('head', grey ? greyM : hm, HX * k, HY * k, HZ * k, 0, CY, .003, 1.52, .56);
          for (const sd of [-1, 1]) B.ell('head', grey ? greyM : hm, .007, .024, .028, sd * (HX * .925), CY + .03, -.048, { seg: 6 }); // sideburns
        }
      }
    }

    if (cfg.cap) {   // small pinned nurse's cap sitting on the crown
      const cp = M(cfg.cap, .8);
      B.cap('head', cp, HX * .9, HY * .8, HZ * .95, 0, CY + .075, .025, .95, .5);
      B.box('head', M(0xc83a3a, .8), .028, .008, .006, 0, CY + .135, -.07, { rx: -.5 });
    }

    // ---- arms ---------------------------------------------------------------------
    const longSleeve = sleeves === 'long' || sleeves === 'rolled';
    const sleeveM = cfg.labCoat ? M(0xf3f1ea, .85) : (cfg.blazer || cfg.cardigan) ? M(cfg.blazer || cfg.cardigan, .85) : shirt;
    for (const side of [-1, 1]) {
      const an = side < 0 ? 'armL' : 'armR', en = side < 0 ? 'elbowL' : 'elbowR', x = side * sxJ;
      const ar = .046 * lk * (female ? .92 : 1);
      B.ell(an, sleeveM, .056 * lk, .058 * lk, .058 * lk, x, SHOULDER_Y - .012, 0, { seg: 10 });
      B.cyl(an, skin, ar, ar * .84, .31, x, SHOULDER_Y - .155, 0, { seg: 9 });
      const sleeveLen = longSleeve ? .3 : .165;
      B.cyl(an, sleeveM, ar + .01, ar + .006, sleeveLen, x, SHOULDER_Y - sleeveLen / 2 - .005, 0, { seg: 10 });
      B.ell(en, longSleeve ? sleeveM : skin, .043 * lk, .043 * lk, .043 * lk, x, ELBOW_Y, 0, { seg: 8 });
      if (sleeves === 'long' || cfg.labCoat) {
        B.cyl(en, sleeveM, ar * .88, .036 * lk, .25, x, ELBOW_Y - .125, 0, { seg: 9 });
        B.cyl(en, shirtShade, .038 * lk, .038 * lk, .025, x, ELBOW_Y - .26, 0, { seg: 9 });
        B.cyl(en, skin, .031 * lk, .028 * lk, .02, x, ELBOW_Y - .28, 0, { seg: 8 });
      } else {
        B.cyl(en, skin, .04 * lk, .03 * lk, .27, x, ELBOW_Y - .135, 0, { seg: 9 });
        if (sleeves === 'rolled') B.cyl(en, sleeveM, .047 * lk, .045 * lk, .06, x, ELBOW_Y - .03, 0, { seg: 9 });
      }
      // hand: palm, four fingers (slightly curled) and a thumb
      const hy = ELBOW_Y - .30; const hs2 = female ? .92 : 1;
      B.ell(en, skin, .034 * hs2, .05 * hs2, .02 * hs2, x, hy - .03, 0, { seg: 8 });
      B.ell(en, skin, .03 * hs2, .042 * hs2, .014 * hs2, x, hy - .1, -.012, { seg: 8, rx: -.25 });
      B.ell(en, skin, .011 * hs2, .03 * hs2, .012 * hs2, x - side * .03 * hs2 * -1, hy - .04, -.02, { seg: 6, rz: side * .5, rx: -.3 });
      // wrist watch for some adults
      if (cfg.watch && side < 0) B.cyl(en, M(0x2a2e31, .4, { metal: .4 }), .036, .036, .022, x, ELBOW_Y - .275, 0, { seg: 9 });
    }
    // accessories held in the hand (chalk / ruler / book) are positioned by the game; here only a held chalk piece
    if (cfg.chalk) B.cyl('elbowR', M(0xf2f0e6, .9), .006, .006, .05, sxJ, ELBOW_Y - .35, -.03, { seg: 5, rx: 1.2 });
    if (cfg.pointer) B.cyl('elbowR', M(0x9a7040, .7), .006, .005, .6, sxJ, ELBOW_Y - .5, -.18, { seg: 5, rx: 1.25 });
    if (cfg.book) {
      B.box('elbowL', M(cfg.book, .8), .17, .02, .23, -sxJ, ELBOW_Y - .31, -.06, { rx: .1 });
      B.box('elbowL', M(0xf0ead6, .9), .15, .016, .21, -sxJ, ELBOW_Y - .295, -.06, { rx: .1 });
    }

    B.flush();

    // ---- assemble ---------------------------------------------------------------------
    const body = new T.Group(); body.name = 'body';
    body.add(B.bones.root.group); body.scale.set(s, s, s);
    const h = new T.Group(); h.add(body);
    const b = B.bones;
    h.userData.rig = {
      body, root: b.root.group, spine: b.spine.group, head: b.head.group,
      armL: b.armL.group, armR: b.armR.group, elbowL: b.elbowL.group, elbowR: b.elbowR.group,
      hipL: b.hipL.group, hipR: b.hipR.group, kneeL: b.kneeL.group, kneeR: b.kneeR.group,
      s, female, adult, skirt: bottomKind === 'skirt', topY: 1.98 * s,
      off: R() * 20, cur: {}, st: { phase: R() * 6, amp: 0, lookT: 0, ly: 0, lx: 0, tly: 0, tlx: 0 }
    };
    h.userData.joints = { arms: [b.armL.group, b.armR.group], legs: [b.hipL.group, b.hipR.group] };
    return h;
  }

  // ===========================================================================
  //  POSES & ANIMATION
  // ===========================================================================
  const KEYS = ['sx', 'sy', 'sz', 'hx', 'hy', 'aLx', 'aLz', 'aRx', 'aRz', 'eL', 'eR', 'hLx', 'hLz', 'hRx', 'hRz', 'kL', 'kR', 'rootY'];

  function update(h, dt, o) {
    const rig = h && h.userData && h.userData.rig; if (!rig) return;
    o = o || {}; dt = Math.min(dt || 0, .06);
    const t = o.t || 0, st = rig.st, s = rig.s, off = rig.off;
    const speed = o.speed || 0, run = !!o.run, sit = o.mode === 'sit', act = o.act || 'idle';
    const walkTarget = (!sit && speed > .05) ? 1 : 0;
    st.amp += (walkTarget - st.amp) * (1 - Math.exp(-dt * 9));
    if (speed > .05 && !sit) st.phase += dt * (3.2 + speed * 1.6);
    const A = st.amp * clamp(.55 + speed * .12, .55, 1.05) * (run ? 1.12 : 1) * (o.stride || 1);
    const ph = st.phase, sn = Math.sin(ph), cs = Math.cos(ph);
    const idle = 1 - st.amp;
    const P = {}; for (const k of KEYS) P[k] = 0;

    // --- walking cycle (scaled by amp) ---
    P.hLx = sn * .62 * A; P.hRx = -sn * .62 * A;
    P.kL = -(.10 * A + Math.max(0, cs) * .85 * A); P.kR = -(.10 * A + Math.max(0, -cs) * .85 * A);
    P.aLx = -sn * .55 * A; P.aRx = sn * .55 * A;
    P.eL = .18 * A + Math.max(0, -sn) * .55 * A; P.eR = .18 * A + Math.max(0, sn) * .55 * A;
    P.sy = -sn * .09 * A; P.sz = cs * .02 * A; P.sx = -(run ? .15 : .03) * A;
    P.hy = sn * .05 * A;
    P.rootY = .016 * A * Math.cos(2 * ph);
    // --- relaxed standing arms ---
    P.aLz = -.09 * idle - .06 * A; P.aRz = .09 * idle + .06 * A;
    P.aLx += (.05 + Math.sin(t * 1.3 + off) * .02) * idle; P.aRx += (.05 + Math.sin(t * 1.1 + off + 1) * .02) * idle;
    P.eL += .12 * idle; P.eR += .12 * idle;
    // breathing / weight shift
    P.sx += Math.sin(t * 1.6 + off) * .01 * idle; P.sz += Math.sin(t * .5 + off) * .012 * idle;
    P.hLz = Math.sin(t * .35 + off) * .015 * idle; P.hRz = -P.hLz;

    // --- sitting ---
    if (sit) {
      const seat = o.seatHip || SEAT_HIP;
      const th = Math.acos(clamp((seat / s - (SHIN + FOOT_H)) / THIGH, -1, 1));
      P.hLx = P.hRx = th; P.kL = P.kR = -th;
      const sp = rig.skirt ? .035 : .1; P.hLz = -sp; P.hRz = sp;
      P.rootY = seat / s - HIP_Y; P.sx = -.04; P.sy = P.sz = 0;
    }

    // --- activities (arms / head / spine) ---
    const sw = (f, a) => Math.sin(t * f + off) * a;
    switch (act) {
      case 'desk_listen':
        P.aLx = P.aRx = .62; P.aLz = -.05; P.aRz = .05; P.eL = P.eR = 1.0; P.sx -= .03; P.hx = .03; break;
      case 'desk_write':
        P.aLx = .62; P.aLz = -.05; P.eL = 1.05; P.aRx = .62 + sw(9, .02); P.aRz = .05 + sw(3, .03); P.eR = 1.0 + sw(11, .05);
        P.hx = -.4; P.sx -= .1; break;
      case 'desk_read':
        P.aLx = P.aRx = .8; P.eL = P.eR = 1.5; P.hx = -.3; P.sx -= .06; break;
      case 'raise_hand':
        P.aLx = .62; P.aLz = -.05; P.eL = 1.0; P.aRx = 2.85 + sw(4, .05); P.aRz = .16; P.eR = .1 + sw(5, .05); P.hx = .06; P.sx -= .0; break;
      case 'teach_write':
        P.aRx = 2.3 + sw(.7, .14); P.aRz = .05 + sw(1.3, .08); P.eR = .15 + sw(6, .07);
        P.aLx = .35; P.aLz = -.1; P.eL = .7; P.hx = .2; P.sy = .06; break;
      case 'teach_explain':
        P.aRx = .85 + sw(2.1, .35); P.eR = 1.1 + sw(2.1 + 1, .3); P.aRz = .15;
        P.aLx = .55 + sw(1.7, .25); P.eL = 1.15 + sw(1.4, .2); P.aLz = -.12;
        P.hy = sw(.55, .5); P.sy = sw(.4, .12); P.hx = .02; break;
      case 'teach_point':
        P.aRx = 1.5; P.aRz = .06; P.eR = .12; P.aLx = .45; P.eL = .9; P.aLz = -.1; P.hx = -.02; break;
      case 'lean_over':
        P.sx = -.3; P.aRx = .85; P.eR = .7; P.aLx = .3; P.eL = .8; P.hx = -.15; break;
      case 'bench':
        P.aLx = P.aRx = .85; P.eL = P.eR = .85; P.hx = -.28; P.sx -= .1; P.aRx += sw(8, .025); P.eR += sw(10, .04); break;
      case 'bench_watch':
        P.aLx = P.aRx = .75; P.eL = P.eR = .9; P.hx = .0; P.sx -= .04; break;
      case 'talk':
        P.aRx = .8 + sw(2.3, .4); P.eR = 1.1 + sw(2.3 + 1, .3); P.aRz = .16;
        P.aLx = .25 + sw(1.7, .15); P.eL = .5; P.hy = sw(.8, .15); break;
      case 'dine': {
        const bite = Math.pow(Math.max(0, Math.sin(t * .7 + off)), 2);
        P.aLx = .9; P.eL = .75; P.aRx = .9 - bite * .2; P.eR = .75 + bite * 1.15; P.hx = -.16 + bite * .12; P.sx -= .05; break; }
      case 'hold_book':
        P.aLx = 1.0; P.eL = 1.7; P.aLz = .02; P.hx = -.12; break;
      default: break;
    }

    // --- eyes/head wander when not told otherwise ---
    st.lookT -= dt;
    if (st.lookT <= 0) { st.lookT = 1.6 + Math.random() * 3.5; const lim = sit ? .35 : .55; st.tly = (Math.random() * 2 - 1) * lim; st.tlx = (Math.random() * 2 - 1) * .08; }
    const wantLook = (act === 'idle' || act === 'desk_listen' || act === 'bench_watch' || act === 'talk') ? 1 : .0;
    st.ly += (st.tly - st.ly) * (1 - Math.exp(-dt * 2.5)); st.lx += (st.tlx - st.lx) * (1 - Math.exp(-dt * 2.5));
    P.hy += (o.look ? o.look.y : st.ly * wantLook) * (1 - st.amp * .8);
    P.hx += (o.look ? o.look.x : st.lx * wantLook);

    // --- smoothing and application ---
    const k = 1 - Math.exp(-dt * (o.rate || 12)); const c = rig.cur;
    for (const key of KEYS) { c[key] = (c[key] === undefined) ? P[key] : c[key] + (P[key] - c[key]) * k; }
    rig.spine.rotation.set(c.sx, c.sy, c.sz); rig.head.rotation.set(c.hx, c.hy, 0);
    rig.armL.rotation.set(c.aLx, 0, c.aLz); rig.armR.rotation.set(c.aRx, 0, c.aRz);
    rig.elbowL.rotation.x = c.eL; rig.elbowR.rotation.x = c.eR;
    rig.hipL.rotation.set(c.hLx, 0, c.hLz); rig.hipR.rotation.set(c.hRx, 0, c.hRz);
    rig.kneeL.rotation.x = c.kL; rig.kneeR.rotation.x = c.kR;
    rig.body.position.y = c.rootY * s;
    rig.topY = 1.98 * s + c.rootY * s;
  }

  const API = { create, update, SEAT_HIP, setTHREE(t) { T = t; }, hashStr, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.UHHumans = API;
})(typeof window !== 'undefined' ? window : globalThis);
