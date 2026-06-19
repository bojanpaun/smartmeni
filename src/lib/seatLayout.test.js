import { describe, it, expect } from 'vitest'
import { getSeatPositions } from './seatLayout'

const onEdge = (p, w, h, tol = 0.001) =>
  Math.abs(p.x) < tol || Math.abs(p.x - w) < tol ||
  Math.abs(p.y) < tol || Math.abs(p.y - h) < tol

describe('getSeatPositions', () => {
  it('vraća prazno za 0 sjedišta', () => {
    expect(getSeatPositions('rect', 80, 80, 0)).toEqual([])
  })

  it('vraća prazno za nevalidne dimenzije', () => {
    expect(getSeatPositions('rect', 0, 80, 4)).toEqual([])
    expect(getSeatPositions('circle', 80, 0, 4)).toEqual([])
  })

  it('broj stolica == broj sjedišta', () => {
    expect(getSeatPositions('rect', 100, 60, 6)).toHaveLength(6)
    expect(getSeatPositions('circle', 80, 80, 5)).toHaveLength(5)
  })

  it('rect: sve stolice su na obimu stola (inset 0)', () => {
    const pts = getSeatPositions('rect', 80, 80, 8, 0)
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(80)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(80)
      expect(onEdge(p, 80, 80)).toBe(true)
    }
  })

  it('rect: inset uvlači stolice ka unutra (top red y === inset)', () => {
    const pts = getSeatPositions('rect', 80, 80, 4, 7)
    // 4 sjedišta na kvadratu → jedno po strani; gornja stolica ima y === inset
    const top = pts.find(p => Math.abs(p.y - 7) < 0.001)
    expect(top).toBeTruthy()
  })

  it('circle: stolice su na radijusu (min(w,h)/2 - inset) od centra', () => {
    const w = 100, h = 80, inset = 6
    const pts = getSeatPositions('circle', w, h, 6, inset)
    const r = Math.min(w, h) / 2 - inset
    for (const p of pts) {
      const d = Math.hypot(p.x - w / 2, p.y - h / 2)
      expect(d).toBeCloseTo(r, 5)
    }
  })

  it('ograničava nerealno velik broj sjedišta (cap 40)', () => {
    expect(getSeatPositions('rect', 80, 80, 999)).toHaveLength(40)
  })
})
