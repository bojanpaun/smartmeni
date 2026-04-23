// ▶ Novi fajl: src/modules/tables/pages/TableMapEditor.jsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './TableMapEditor.module.css'

const MIN_SIZE = 50
const GRID = 10 // snap to grid

function snapToGrid(val) {
  return Math.round(val / GRID) * GRID
}

export default function TableMapEditor() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()

  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('select') // 'select' | 'add-rect' | 'add-circle'
  const [showQR, setShowQR] = useState(null)

  const canvasRef = useRef(null)
  const dragging = useRef(null)
  const resizing = useRef(null)

  useEffect(() => {
    if (restaurant) loadTables()
  }, [restaurant])

  const loadTables = async () => {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('number')
    setTables(data || [])
    setLoading(false)
  }

  // ── Dodavanje stola ────────────────────────────────────────
  const handleCanvasClick = (e) => {
    if (mode === 'select') {
      setSelected(null)
      return
    }
    const rect = canvasRef.current.getBoundingClientRect()
    const x = snapToGrid(e.clientX - rect.left - 40)
    const y = snapToGrid(e.clientY - rect.top - 40)
    const maxNum = tables.length ? Math.max(...tables.map(t => t.number)) : 0
    const newTable = {
      id: `tmp-${Date.now()}`,
      restaurant_id: restaurant.id,
      number: maxNum + 1,
      label: `Sto ${maxNum + 1}`,
      x, y,
      width: 80,
      height: mode === 'add-circle' ? 80 : 80,
      shape: mode === 'add-circle' ? 'circle' : 'rect',
      seats: 4,
      status: 'free',
      isNew: true,
    }
    setTables(prev => [...prev, newTable])
    setSelected(newTable.id)
    setMode('select')
  }

  // ── Drag ──────────────────────────────────────────────────
  const startDrag = (e, tableId) => {
    if (mode !== 'select') return
    e.stopPropagation()
    const table = tables.find(t => t.id === tableId)
    const rect = canvasRef.current.getBoundingClientRect()
    dragging.current = {
      id: tableId,
      startX: e.clientX,
      startY: e.clientY,
      origX: table.x,
      origY: table.y,
    }
    setSelected(tableId)

    const onMove = (e) => {
      const d = dragging.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      setTables(prev => prev.map(t => t.id === tableId
        ? { ...t, x: snapToGrid(Math.max(0, d.origX + dx)), y: snapToGrid(Math.max(0, d.origY + dy)) }
        : t
      ))
    }
    const onUp = () => {
      dragging.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Resize ────────────────────────────────────────────────
  const startResize = (e, tableId) => {
    e.stopPropagation()
    const table = tables.find(t => t.id === tableId)
    resizing.current = {
      id: tableId,
      startX: e.clientX,
      startY: e.clientY,
      origW: table.width,
      origH: table.height,
    }

    const onMove = (e) => {
      if (!resizing.current) return
      const dw = e.clientX - resizing.current.startX
      const dh = e.clientY - resizing.current.startY
      setTables(prev => prev.map(t => t.id === tableId
        ? {
            ...t,
            width: snapToGrid(Math.max(MIN_SIZE, resizing.current.origW + dw)),
            height: snapToGrid(Math.max(MIN_SIZE, resizing.current.origH + dh)),
          }
        : t
      ))
    }
    const onUp = () => {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Brisanje stola ────────────────────────────────────────
  const deleteTable = async (id) => {
    if (!confirm('Obrisati ovaj sto?')) return
    if (!id.startsWith('tmp-')) {
      await supabase.from('tables').delete().eq('id', id)
    }
    setTables(prev => prev.filter(t => t.id !== id))
    setSelected(null)
  }

  // ── Izmjena labele / sjedišta ──────────────────────────────
  const updateTableProp = (id, prop, value) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, [prop]: value } : t))
  }

  // ── Čuvanje u bazu ────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      for (const table of tables) {
        const payload = {
          restaurant_id: restaurant.id,
          number: table.number,
          label: table.label,
          x: table.x,
          y: table.y,
          width: table.width,
          height: table.height,
          shape: table.shape,
          seats: table.seats,
          status: table.status,
        }
        if (table.isNew || table.id.startsWith('tmp-')) {
          const { data } = await supabase.from('tables').insert(payload).select().single()
          setTables(prev => prev.map(t => t.id === table.id ? { ...data } : t))
        } else {
          await supabase.from('tables').update(payload).eq('id', table.id)
        }
      }
      setSaveMsg('Sačuvano!')
    } catch (err) {
      setSaveMsg('Greška pri čuvanju')
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const selectedTable = tables.find(t => t.id === selected)

  if (loading) return <div className={styles.loading}>Učitavanje mape stolova...</div>

  return (
    <div className={styles.wrap}>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button
            className={`${styles.toolBtn} ${mode === 'select' ? styles.toolBtnActive : ''}`}
            onClick={() => setMode('select')}
            title="Selektuj / pomjeri sto"
          >
            ↖ Selektuj
          </button>
          <button
            className={`${styles.toolBtn} ${mode === 'add-rect' ? styles.toolBtnActive : ''}`}
            onClick={() => setMode('add-rect')}
            title="Dodaj kvadratni sto"
          >
            ▢ Kvadratni sto
          </button>
          <button
            className={`${styles.toolBtn} ${mode === 'add-circle' ? styles.toolBtnActive : ''}`}
            onClick={() => setMode('add-circle')}
            title="Dodaj okrugli sto"
          >
            ○ Okrugli sto
          </button>
        </div>
        <div className={styles.toolbarRight}>
          {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
          <button className={styles.btnSave} onClick={saveAll} disabled={saving}>
            {saving ? 'Čuvanje...' : 'Sačuvaj mapu'}
          </button>
          <button className={styles.btnView} onClick={() => navigate('/admin/tables/view')}>
            Prikaz konobara →
          </button>
        </div>
      </div>

      <div className={styles.editorLayout}>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className={`${styles.canvas} ${mode !== 'select' ? styles.canvasAdd : ''}`}
          onClick={handleCanvasClick}
        >
          {/* Grid pozadina */}
          <div className={styles.canvasGrid} />

          {/* Hint za mode */}
          {mode !== 'select' && (
            <div className={styles.canvasHint}>
              Klikni na canvas da dodaš {mode === 'add-circle' ? 'okrugli' : 'kvadratni'} sto
            </div>
          )}

          {/* Stolovi */}
          {tables.map(table => (
            <div
              key={table.id}
              className={`${styles.tableEl} ${selected === table.id ? styles.tableElSelected : ''} ${styles[`status-${table.status}`]}`}
              style={{
                left: table.x,
                top: table.y,
                width: table.width,
                height: table.height,
                borderRadius: table.shape === 'circle' ? '50%' : 8,
              }}
              onMouseDown={(e) => startDrag(e, table.id)}
              onClick={(e) => { e.stopPropagation(); setSelected(table.id) }}
            >
              <div className={styles.tableLabel}>{table.label || `Sto ${table.number}`}</div>
              <div className={styles.tableSeats}>{table.seats} mjesta</div>

              {/* Resize handle */}
              {selected === table.id && (
                <div
                  className={styles.resizeHandle}
                  onMouseDown={(e) => startResize(e, table.id)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Properties panel */}
        <div className={styles.panel}>
          {selectedTable ? (
            <>
              <div className={styles.panelTitle}>Sto {selectedTable.number}</div>

              <div className={styles.field}>
                <label>Naziv</label>
                <input
                  value={selectedTable.label || ''}
                  onChange={e => updateTableProp(selectedTable.id, 'label', e.target.value)}
                  placeholder={`Sto ${selectedTable.number}`}
                />
              </div>

              <div className={styles.field}>
                <label>Broj mjesta</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={selectedTable.seats}
                  onChange={e => updateTableProp(selectedTable.id, 'seats', parseInt(e.target.value))}
                />
              </div>

              <div className={styles.field}>
                <label>Oblik</label>
                <div className={styles.shapeToggle}>
                  <button
                    className={selectedTable.shape === 'rect' ? styles.shapeActive : ''}
                    onClick={() => updateTableProp(selectedTable.id, 'shape', 'rect')}
                  >
                    ▢ Kvadrat
                  </button>
                  <button
                    className={selectedTable.shape === 'circle' ? styles.shapeActive : ''}
                    onClick={() => updateTableProp(selectedTable.id, 'shape', 'circle')}
                  >
                    ○ Krug
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label>Širina</label>
                <input
                  type="number"
                  value={selectedTable.width}
                  onChange={e => updateTableProp(selectedTable.id, 'width', parseInt(e.target.value))}
                />
              </div>
              <div className={styles.field}>
                <label>Visina</label>
                <input
                  type="number"
                  value={selectedTable.height}
                  onChange={e => updateTableProp(selectedTable.id, 'height', parseInt(e.target.value))}
                />
              </div>

              <div className={styles.panelActions}>
                <button
                  className={styles.btnQR}
                  onClick={() => setShowQR(selectedTable)}
                >
                  QR kod
                </button>
                <button
                  className={styles.btnDelete}
                  onClick={() => deleteTable(selectedTable.id)}
                >
                  Obriši sto
                </button>
              </div>
            </>
          ) : (
            <div className={styles.panelEmpty}>
              <div className={styles.panelEmptyIcon}>🗺️</div>
              <div>Klikni na sto da urediš detalje</div>
              <div className={styles.panelLegend}>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.dotFree}`} /> Slobodan
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.dotOccupied}`} /> Zauzet
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.dotCalling}`} /> Zove konobara
                </div>
              </div>
            </div>
          )}

          {/* Lista stolova */}
          <div className={styles.tableList}>
            <div className={styles.tableListTitle}>Svi stolovi ({tables.length})</div>
            {tables.map(t => (
              <div
                key={t.id}
                className={`${styles.tableListItem} ${selected === t.id ? styles.tableListItemActive : ''}`}
                onClick={() => setSelected(t.id)}
              >
                <span className={`${styles.legendDot} ${styles[`dot${t.status.charAt(0).toUpperCase() + t.status.slice(1)}`]}`} />
                <span>{t.label || `Sto ${t.number}`}</span>
                <span className={styles.tableListSeats}>{t.seats} mj.</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QR modal */}
      {showQR && (
        <div className={styles.qrOverlay} onClick={() => setShowQR(null)}>
          <div className={styles.qrModal} onClick={e => e.stopPropagation()}>
            <button className={styles.qrClose} onClick={() => setShowQR(null)}>✕</button>
            <div className={styles.qrTitle}>QR kod — {showQR.label || `Sto ${showQR.number}`}</div>
            <div className={styles.qrUrl}>
              {`${window.location.origin}/${restaurant.slug}?table=${showQR.number}`}
            </div>
            <div className={styles.qrBox}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/${restaurant.slug}?table=${showQR.number}`)}`}
                alt="QR kod"
                width={200}
                height={200}
              />
            </div>
            <a
              href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${window.location.origin}/${restaurant.slug}?table=${showQR.number}`)}`}
              download={`qr-sto-${showQR.number}.png`}
              className={styles.qrDownload}
            >
              Preuzmi QR kod
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
