export const PALETTE = ['#19199A', '#EE7D38', '#4C4DF6', '#66BCF9', '#1E9E6B', '#E0A61A', '#D64545', '#7A5CFA'];

// ponytail: native View Transitions API, falls back to a plain DOM update when unsupported
export function withViewTransition(fn) {
  if (!document.startViewTransition) {
    fn();
    return;
  }
  document.startViewTransition(fn);
}

export function colorFor(id, list) {
  const idx = list.findIndex((x) => x.id === id);
  return PALETTE[idx % PALETTE.length];
}

export function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

export function tenureYears(dateStr, toDateStr) {
  if (!dateStr) return null;
  const from = new Date(dateStr + 'T00:00:00');
  if (isNaN(from)) return null;
  const to = toDateStr ? new Date(toDateStr + 'T00:00:00') : new Date();
  if (isNaN(to)) return null;
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

export function fmtYears(y) {
  if (y === null || y === undefined) return '—';
  return y.toFixed(1) + ' años';
}

export function tenureBuckets(values) {
  const buckets = { '0–1 año': 0, '1–3 años': 0, '3–5 años': 0, '5+ años': 0 };
  values.forEach((y) => {
    if (y < 1) buckets['0–1 año']++;
    else if (y < 3) buckets['1–3 años']++;
    else if (y < 5) buckets['3–5 años']++;
    else buckets['5+ años']++;
  });
  return buckets;
}
