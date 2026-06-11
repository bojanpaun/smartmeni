// ════════════════════════════════════════════════════════════════════════════
// Brend → admin paleta: izvođenje pune palete (7 light + 7 dark tokena) iz jedne
// boje, HSL ramp-om. Jedinstveni izvor logike za:
//   • ThemePalettesAdmin ("Generiši nijanse" — superadmin custom palete)
//   • useTheme (rezervisani admin_theme key 'brand' → izvedi iz restaurant.color)
//   • BrandSettings ("Uskladi admin temu sa brendom" + najbliži predložak menija)
//
// Iz bazne boje uzimamo hue + saturaciju, pa svakom tokenu zadajemo ciljni
// lightness (S/L preuzeti iz green/green-dark baze) za sklad. light.primary ostaje
// tačno bazna boja; ostalo su izvedene nijanse — sve ostaje ručno nadjačivo.
// ════════════════════════════════════════════════════════════════════════════

const clamp = (v) => Math.min(100, Math.max(0, v))

export function hexToRgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '')
  if (!m) return { r: 0, g: 0, b: 0 }
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function hexToHsl(hex) {
  const { r: R, g: G, b: B } = hexToRgb(hex)
  const r = R / 255, g = G / 255, b = B / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslToHex(h, s, l) {
  s = clamp(s) / 100
  l = clamp(l) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x } else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c } else { r = c; b = x }
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return '#' + to(r) + to(g) + to(b)
}

// Izvedi { light, dark } mape sa 7 brend tokena (key-evi se poklapaju sa
// theme_palettes.light/dark i TOKEN_MAP u useTheme.js).
export function deriveShades(base) {
  const { h, s, l } = hexToHsl(base)
  return {
    light: {
      primary:       base,
      primaryHover:  hslToHex(h, s, clamp(l - 7)),
      primaryMedium: hslToHex(h, s, clamp(l + 12)),
      primaryLight:  hslToHex(h, Math.min(s, 60), 94),
      primaryMuted:  hslToHex(h, clamp(s - 20), 72),
      sbBg:          hslToHex(h, Math.min(s + 10, 90), 12),
      sbAccent:      hslToHex(h, s, 60),
    },
    dark: {
      primary:       hslToHex(h, s, 62),
      primaryHover:  hslToHex(h, s, 75),
      primaryMedium: hslToHex(h, s, 55),
      primaryLight:  hslToHex(h, clamp(s - 10), 16),
      primaryMuted:  hslToHex(h, clamp(s - 25), 32),
      sbBg:          hslToHex(h, Math.min(s + 5, 90), 8),
      sbAccent:      hslToHex(h, s, 62),
    },
  }
}
