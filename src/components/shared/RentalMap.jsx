import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix Leaflet default marker ikonica pod Vite bundlerom (inače slomljene putanje).
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const DEFAULT_CENTER = [42.4304, 18.7712] // Boka/Budva okolina
const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '© OpenStreetMap'

// Dvije uloge:
//  • editable=true: jedan prevlačiv pin → onChange({lat,lng}) (admin, izbor lokacije)
//  • editable=false: markeri (markers=[{id,lat,lng,label,sublabel}]), klik → onSelect(id)
// Leaflet se učitava u ovom (lazy) chunk-u — ne ulazi u init bundle.
export default function RentalMap({
  markers = [], value = null, onChange, onSelect, editable = false, height = 320,
}) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const onSelectRef = useRef(onSelect)
  onChangeRef.current = onChange
  onSelectRef.current = onSelect

  // Init mape jednom.
  useEffect(() => {
    if (mapRef.current || !elRef.current) return
    const start = value && value.lat != null ? [value.lat, value.lng]
      : markers.length ? [markers[0].lat, markers[0].lng] : DEFAULT_CENTER
    const map = L.map(elRef.current, { scrollWheelZoom: false }).setView(start, 13)
    L.tileLayer(TILE, { attribution: ATTR, maxZoom: 19 }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    if (editable) {
      map.on('click', (e) => onChangeRef.current?.({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }))
    }
    // Leaflet ponekad promaši veličinu kad je kontejner tek montiran.
    setTimeout(() => map.invalidateSize(), 200)
    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable])

  // Editable: drži jedan prevlačiv marker na value.
  useEffect(() => {
    const map = mapRef.current, lg = layerRef.current
    if (!map || !lg || !editable) return
    lg.clearLayers()
    if (value && value.lat != null) {
      const m = L.marker([value.lat, value.lng], { draggable: true }).addTo(lg)
      m.on('dragend', () => { const p = m.getLatLng(); onChangeRef.current?.({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }) })
      map.setView([value.lat, value.lng], map.getZoom() || 14)
    }
  }, [editable, value?.lat, value?.lng])

  // Read-only: markeri sa tooltipom, klik → onSelect.
  useEffect(() => {
    const map = mapRef.current, lg = layerRef.current
    if (!map || !lg || editable) return
    lg.clearLayers()
    const pts = markers.filter(mk => mk.lat != null && mk.lng != null)
    pts.forEach(mk => {
      const m = L.marker([mk.lat, mk.lng]).addTo(lg)
      m.bindTooltip(`${mk.label}${mk.sublabel ? ` · ${mk.sublabel}` : ''}`, { direction: 'top' })
      m.on('click', () => onSelectRef.current?.(mk.id))
    })
    if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 14)
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])).pad(0.25))
  }, [editable, markers])

  return <div ref={elRef} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0 }} />
}
