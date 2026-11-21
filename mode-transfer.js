// Carry the applied cube (not an edited input or solved preview) across mode reloads.
function createModeTransfer(model) {
  const slots = model.solved();
  const key = s => s.p.join(',') + '/' + s.n.join(',');
  const index = new Map(slots.map((s, i) => [key(s), i]));
  const colors = ['gray', 'green', 'orange'];
  function encode(state) {
    return state.map(s => {
      const slot = index.get(key(s)), color = colors.indexOf(s.color);
      if (slot === undefined || color < 0) throw new Error('Cannot transfer this cube state.');
      return slot.toString(36).padStart(2, '0') + color;
    }).join('');
  }
  function decode(text) {
    if (text.length !== slots.length * 3 || !/^[0-9a-z]+$/.test(text)) throw new Error('Invalid saved case.');
    const seen = new Set();
    const state = slots.map((_, i) => {
      const slot = parseInt(text.slice(i * 3, i * 3 + 2), 36), color = Number(text[i * 3 + 2]);
      if (slot >= slots.length || seen.has(slot) || !colors[color]) throw new Error('Invalid saved case.');
      seen.add(slot);
      return {p: [...slots[slot].p], n: [...slots[slot].n], color: colors[color]};
    });
    return state;
  }
  function url(href, mode, state, draft) {
    const target = new URL(href);
    target.searchParams.set('mode', mode);
    target.searchParams.set('cube', encode(state));
    target.searchParams.set('draft', draft);
    return target.href;
  }
  return {encode, decode, url};
}
if (typeof module !== 'undefined') module.exports = {createModeTransfer};
