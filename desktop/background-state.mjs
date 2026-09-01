export function normalizeAttentionCount(value) {
  const count = Number(value);
  return Number.isFinite(count)
    ? Math.max(0, Math.min(99, Math.floor(count)))
    : 0;
}

export function attentionLabel(value) {
  const count = normalizeAttentionCount(value);
  return count
    ? `schwank · ${count} notification${count === 1 ? '' : 's'}`
    : 'schwank';
}

export function shouldHideWindowOnClose(isQuitting) {
  return !isQuitting;
}
