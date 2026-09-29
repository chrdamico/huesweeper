export const PALETTES = {
  candy: { name: 'Candy', colors: ['#FF6B8B', '#4DA3FF', '#FFC43D', '#35C98A'] },
  sunset: { name: 'Sunset', colors: ['#FF7A45', '#7B61FF', '#FFD166', '#EF476F'] },
  ocean: { name: 'Lagoon', colors: ['#12B5CB', '#FF9F1C', '#9BE564', '#C77DFF'] },
  forest: { name: 'Forest', colors: ['#6A994E', '#E9C46A', '#BC4749', '#577590'] },
  contrast: { name: 'High contrast', colors: ['#E69F00', '#0072B2', '#F0E442', '#CC79A7'] },
  mono: { name: 'Ink', colors: ['#2E2A36', '#F7F5F0', '#9A95A6', '#D4B483'] },
};

export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function textOn(hex) {
  return luminance(hex) > 0.36 ? '#1F1D2B' : '#FFFFFF';
}

export function paletteFor(puzzle, settings) {
  if (puzzle.palette) return puzzle.palette;
  return (PALETTES[settings.palette] || PALETTES.candy).colors;
}

export function applyPalette(el, colors) {
  colors.forEach((c, k) => {
    el.style.setProperty(`--c${k}`, c);
    el.style.setProperty(`--t${k}`, textOn(c));
  });
}
