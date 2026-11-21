    const CubeModel = (() => {
      const directions = { R: [0, 1], L: [0, -1], U: [1, 1], D: [1, -1], F: [2, 1], B: [2, -1] };
      function solved() {
        const stickers = [];
        for (const [face, [axis, sign]] of Object.entries(directions)) {
          for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
            const p = [], n = [0, 0, 0];
            p[axis] = sign * 2;
            p[(axis + 1) % 3] = a;
            p[(axis + 2) % 3] = b;
            n[axis] = sign;
            const center = Math.abs(a) < 2 && Math.abs(b) < 2;
            stickers.push({ p, n, color: center && face === 'U' ? 'green' : center && face === 'F' ? 'orange' : 'gray' });
          }
        }
        return stickers;
      }
      function parse(text) {
        const tokens = text.trim().replace(/[\u2019\u2032]/g, "'").split(/\s+/).filter(Boolean);
        return tokens.map((token, index) => {
          const middle = /^M(w)?(2'?|')?$/.exec(token);
          if (middle) {
            // M follows L; M' moves the front stickers toward the top.
            return { axis: 0, sign: -1, middle: true, radius: middle[1] ? 1 : 0, turns: middle[2]?.startsWith('2') ? 2 : middle[2] === "'" ? 3 : 1 };
          }
          const match = /^(?:([234])?([URFDLB])(w)?|([xyz]))(2'?|')?$/.exec(token);
          if (!match || (match[1] && !match[3])) throw new Error(`Invalid move ${index + 1}: "${token}". Use notation like R, Rw, 3Rw, U2, M' or Mw'.`);
          const [, width, face, wide, rotation, suffix] = match;
          const [axis, sign] = rotation ? [{ x: 0, y: 1, z: 2 }[rotation], 1] : directions[face];
          return { axis, sign, width: rotation ? 5 : wide ? Number(width || 2) : 1, turns: suffix?.startsWith('2') ? 2 : suffix === "'" ? 3 : 1 };
        });
      }
      function rotate(v, axis, direction) {
        const a = (axis + 1) % 3, b = (axis + 2) % 3;
        const previous = v[a];
        v[a] = -direction * v[b];
        v[b] = direction * previous;
      }
      function apply(stickers, moves) {
        for (const move of moves) {
          for (const sticker of stickers) {
            if (move.middle
              ? Math.abs(sticker.p[move.axis]) > move.radius
              : sticker.p[move.axis] * move.sign < 3 - move.width) continue;
            for (let t = 0; t < move.turns; t++) {
              rotate(sticker.p, move.axis, -move.sign);
              rotate(sticker.n, move.axis, -move.sign);
            }
          }
        }
        return stickers;
      }
      function visible(stickers, face) {
        const colors = Array(25).fill('gray');
        const axis = face === 'U' ? 1 : 2;
        for (const sticker of stickers) {
          if (sticker.n[axis] !== 1) continue;
          const row = face === 'U' ? sticker.p[2] + 2 : 2 - sticker.p[1];
          colors[row * 5 + sticker.p[0] + 2] = sticker.color;
        }
        return colors;
      }
      function validateL2C(state, { yau = false } = {}) {
        const home = solved();
        // Sticker order retains identity even though non-U/F centers are drawn gray.
        const same = (a, b) => a.every((v, i) => v === b[i]);
        for (let i = 0; i < home.length; i++) {
          const original = home[i], sticker = state[i];
          const center = original.p.filter(v => Math.abs(v) === 2).length === 1;
          if (center && original.color !== 'gray' && sticker.n[1] !== 1 && sticker.n[2] !== 1) {
            throw new Error('Invalid L2C scramble: all green and orange center pieces must stay within the U and F centers.');
          }
          if (center && original.color === 'gray' && !same(original.n, sticker.n)) {
            throw new Error('Invalid L2C scramble: the L, R, D, and B centers must remain solved on their original faces.');
          }
          if (yau && original.p[0] === -2 && original.p[1] !== 2 && original.p.filter(v => Math.abs(v) === 2).length === 2 && (!same(original.p, sticker.p) || !same(original.n, sticker.n))) {
            throw new Error('Invalid Yau scramble: every piece of the FL, DL, and BL edges (F3E) must be preserved.');
          }
        }
        return state;
      }
      return { solved, parse, apply, visible, validateL2C };
    })();

if (typeof module !== "undefined") module.exports = CubeModel;
