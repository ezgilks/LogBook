// Dark, data-forward palette. Green means growing; nothing in the app is red —
// it guides, it doesn't scold.

export const colors = {
  bg: '#0A0C0F',
  card: '#14171C',
  cardHi: '#1B1F26',
  border: '#232831',
  text: '#F2F4F7',
  sub: '#8A93A0',
  faint: '#5A626E',
  grow: '#3DDC84',
  growDim: '#1F6B45',
  idle: '#262B33',
  idleRecent: '#2C3A34',
  never: '#1C2026',
  info: '#5AA9FF',
  nudge: '#F5B84B',
  celebrate: '#FFD166',
  danger: '#FF7A7A',
};

export const radius = { sm: 8, md: 14, lg: 20 };
export const space = (n: number) => n * 4;

export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  sub: { fontSize: 13, color: colors.sub },
  label: { fontSize: 11, fontWeight: '700' as const, color: colors.sub, letterSpacing: 1, textTransform: 'uppercase' as const },
  num: { fontSize: 32, fontWeight: '800' as const, color: colors.text, fontVariant: ['tabular-nums' as const] },
};
