// Pozicije „stolica" oko stola za canvas prikaze (editor, konobar, picker, event).
// Čista funkcija (bez React/Supabase) → lako testabilna; identičan izgled u svim prikazima.
//
// Vraća niz {x, y} — centar svake stolice u KOORDINATAMA STOLA (0,0 = gornji lijevi
// ugao tijela stola; width×height = tijelo stola). Stolice se renderuju kao sibling
// element ISPOD tijela stola (niži z-index) na omotaču sa overflow:visible — tijelo
// stola (viši z-index, neproziran) prekrije unutrašnju polovinu stolice → „pogurana
// pod sto" izgled.
//
// `inset` = koliko je centar stolice uvučen UNUTAR ivice (px). 0 = centar na samoj
// ivici (pola stolice viri, pola pod stolom). Veći inset = stolica više uvučena (više
// skrivena pod stolom). Negativan = više izviri.

const MAX_SEATS = 40 // sanity cap (UI ionako ograničava na 20)

export function getSeatPositions(shape, width, height, seats, inset = 0) {
  const n = Math.max(0, Math.min(Math.floor(seats || 0), MAX_SEATS))
  if (n === 0 || !(width > 0) || !(height > 0)) return []

  if (shape === 'circle') {
    const r = Math.max(Math.min(width, height) / 2 - inset, 2)
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2 // prva stolica na 12h
      return {
        x: width / 2 + r * Math.cos(a),
        y: height / 2 + r * Math.sin(a),
      }
    })
  }

  // rect — hod po obimu: top → right → bottom → left. +0.5 da stolica ne padne na ugao.
  const perim = 2 * (width + height)
  return Array.from({ length: n }, (_, i) => {
    let t = ((i + 0.5) / n) * perim
    if (t < width) return { x: t, y: inset }                       // top
    t -= width
    if (t < height) return { x: width - inset, y: t }              // right
    t -= height
    if (t < width) return { x: width - t, y: height - inset }      // bottom
    t -= width
    return { x: inset, y: height - t }                             // left
  })
}
