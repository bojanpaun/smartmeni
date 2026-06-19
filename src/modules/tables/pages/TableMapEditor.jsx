// ▶ Novi fajl: src/modules/tables/pages/TableMapEditor.jsx

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { getSeatPositions } from '../../../lib/seatLayout'
import styles from './TableMapEditor.module.css'

const MIN_SIZE = 50
const GRID = 10

function snapToGrid(val) {
  return Math.round(val / GRID) * GRID
}

export default function TableMapEditor() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')

  const [tables, setTables] = useState([])
  const [layouts, setLayouts] = useState([])
  const [currentLayoutId, setCurrentLayoutId] = useState(null)
  const [layoutBusy, setLayoutBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('select')
  const [showQR, setShowQR] = useState(null)
  const [editMode, setEditMode] = useState(null) // tableId u touch edit modu

  const canvasRef = useRef(null)
  const dragging = useRef(null)
  const resizing = useRef(null)
  const lastTapRef = useRef(null)     // { id, time } za double-tap detekciju
  const touchDragRef = useRef(null)   // aktivni touch drag
  const touchResizeRef = useRef(null) // aktivni touch resize
  const autoScrollRef = useRef(null)  // interval za auto-scroll

  useEffect(() => {
    if (restaurant) loadLayouts()
  }, [restaurant])

  // Učita sve layout-e; ako ih nema (svjež nalog), kreira default aktivan; zatim
  // učita stolove aktivnog (ili prvog) layouta.
  const loadLayouts = async () => {
    let { data: lays } = await supabase
      .from('table_layouts')
      .select('id, name, is_active')
      .eq('restaurant_id', restaurant.id)
      .order('created_at')
    if (!lays || lays.length === 0) {
      const { data: created } = await supabase
        .from('table_layouts')
        .insert({ restaurant_id: restaurant.id, name: t('tmeDefaultLayoutName'), is_active: true })
        .select('id, name, is_active')
        .single()
      lays = created ? [created] : []
    }
    setLayouts(lays)
    const active = lays.find(l => l.is_active) || lays[0]
    const lid = active?.id || null
    setCurrentLayoutId(lid)
    await loadTables(lid)
  }

  const loadTables = async (layoutId) => {
    if (!layoutId) { setTables([]); setLoading(false); return }
    const { data } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('layout_id', layoutId)
      .order('number')
    setTables(data || [])
    setLoading(false)
  }

  // ── Layout operacije ───────────────────────────────────────
  const switchLayout = async (layoutId) => {
    if (!layoutId || layoutId === currentLayoutId) return
    setCurrentLayoutId(layoutId)
    setSelected(null)
    setEditMode(null)
    setLoading(true)
    await loadTables(layoutId)
  }

  const createLayout = async () => {
    const name = prompt(t('tmePromptLayoutName'))
    if (!name || !name.trim()) return
    setLayoutBusy(true)
    const { data } = await supabase
      .from('table_layouts')
      .insert({ restaurant_id: restaurant.id, name: name.trim(), is_active: false })
      .select('id, name, is_active')
      .single()
    if (data) {
      setLayouts(prev => [...prev, data])
      await switchLayout(data.id)
    }
    setLayoutBusy(false)
  }

  const duplicateLayout = async () => {
    const cur = layouts.find(l => l.id === currentLayoutId)
    const suggested = cur ? `${cur.name} (${t('tmeCopySuffix')})` : ''
    const name = prompt(t('tmePromptLayoutName'), suggested)
    if (!name || !name.trim()) return
    setLayoutBusy(true)
    const { data: newId, error } = await supabase.rpc('duplicate_table_layout', {
      p_layout_id: currentLayoutId, p_new_name: name.trim(),
    })
    if (!error && newId) {
      const { data: lays } = await supabase
        .from('table_layouts').select('id, name, is_active')
        .eq('restaurant_id', restaurant.id).order('created_at')
      setLayouts(lays || [])
      await switchLayout(newId)
    }
    setLayoutBusy(false)
  }

  const renameLayout = async () => {
    const cur = layouts.find(l => l.id === currentLayoutId)
    if (!cur) return
    const name = prompt(t('tmePromptLayoutName'), cur.name)
    if (!name || !name.trim() || name.trim() === cur.name) return
    setLayoutBusy(true)
    await supabase.from('table_layouts').update({ name: name.trim() }).eq('id', cur.id)
    setLayouts(prev => prev.map(l => l.id === cur.id ? { ...l, name: name.trim() } : l))
    setLayoutBusy(false)
  }

  const activateLayout = async () => {
    setLayoutBusy(true)
    const { error } = await supabase.rpc('set_active_table_layout', {
      p_restaurant_id: restaurant.id, p_layout_id: currentLayoutId,
    })
    if (!error) {
      setLayouts(prev => prev.map(l => ({ ...l, is_active: l.id === currentLayoutId })))
      setSaveMsg(t('tmeLayoutActivated'))
      setTimeout(() => setSaveMsg(''), 3000)
    }
    setLayoutBusy(false)
  }

  const deleteLayout = async () => {
    const cur = layouts.find(l => l.id === currentLayoutId)
    if (!cur) return
    if (cur.is_active) { alert(t('tmeCantDeleteActive')); return }
    if (layouts.length <= 1) { alert(t('tmeCantDeleteLast')); return }
    if (!confirm(t('tmeDeleteLayoutConfirm', { name: cur.name }))) return
    setLayoutBusy(true)
    await supabase.from('table_layouts').delete().eq('id', cur.id)  // cascade briše stolove
    const remaining = layouts.filter(l => l.id !== cur.id)
    setLayouts(remaining)
    setLayoutBusy(false)
    const next = remaining.find(l => l.is_active) || remaining[0]
    await switchLayout(next.id)
  }

  // ── Dodavanje stola ────────────────────────────────────────
  const handleCanvasClick = (e) => {
    if (editMode) { setEditMode(null); return }
    if (mode === 'select') { setSelected(null); return }
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    // scrollLeft/Top ispravlja poziciju kad je canvas scrollan
    const x = snapToGrid(e.clientX - rect.left + canvas.scrollLeft - 40)
    const y = snapToGrid(e.clientY - rect.top + canvas.scrollTop - 40)
    const maxNum = tables.length ? Math.max(...tables.map(tb => tb.number)) : 0
    const newTable = {
      id: `tmp-${Date.now()}`,
      restaurant_id: restaurant.id,
      layout_id: currentLayoutId,
      number: maxNum + 1,
      label: `${t('anaTable')} ${maxNum + 1}`,
      x, y,
      width: 80,
      height: 80,
      shape: mode === 'add-circle' ? 'circle' : 'rect',
      seats: 4,
      status: 'free',
      isNew: true,
    }
    setTables(prev => [...prev, newTable])
    setSelected(newTable.id)
    setMode('select')
  }

  // ── Mouse Drag ─────────────────────────────────────────────
  const startDrag = (e, tableId) => {
    if (mode !== 'select') return
    e.stopPropagation()
    const table = tables.find(t => t.id === tableId)
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

  // ── Mouse Resize ───────────────────────────────────────────
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

  // ── Touch: single tap = select, double tap = edit mode ────
  const handleTableTouchStart = (e, tableId) => {
    if (mode !== 'select') return

    if (editMode === tableId) {
      // Već u edit modu — pokreni touch drag
      e.stopPropagation()
      e.preventDefault()
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const touch = e.touches[0]
      const table = tables.find(t => t.id === tableId)
      // Offset = gdje je prst unutar stola (u canvas koordinatama)
      const canvasX = touch.clientX - rect.left + canvas.scrollLeft
      const canvasY = touch.clientY - rect.top + canvas.scrollTop
      touchDragRef.current = {
        id: tableId,
        offsetX: canvasX - table.x,
        offsetY: canvasY - table.y,
      }
      setSelected(tableId)

      const onMove = (ev) => {
        ev.preventDefault()
        const d = touchDragRef.current
        if (!d) return
        const t = ev.touches[0]
        const c = canvasRef.current
        const r = c.getBoundingClientRect()
        const newX = snapToGrid(Math.max(0, t.clientX - r.left + c.scrollLeft - d.offsetX))
        const newY = snapToGrid(Math.max(0, t.clientY - r.top + c.scrollTop - d.offsetY))
        setTables(prev => prev.map(tb => tb.id === d.id ? { ...tb, x: newX, y: newY } : tb))

        // Auto-scroll kad je prst blizu ivice canvasa
        const EDGE = 50, SPEED = 6
        clearInterval(autoScrollRef.current)
        let sx = 0, sy = 0
        const rx = t.clientX - r.left
        const ry = t.clientY - r.top
        if (rx < EDGE) sx = -SPEED
        else if (rx > r.width - EDGE) sx = SPEED
        if (ry < EDGE) sy = -SPEED
        else if (ry > r.height - EDGE) sy = SPEED
        if (sx !== 0 || sy !== 0) {
          const tx = t.clientX, ty = t.clientY
          autoScrollRef.current = setInterval(() => {
            const c2 = canvasRef.current
            if (!c2) return
            c2.scrollLeft += sx
            c2.scrollTop += sy
            const d2 = touchDragRef.current
            if (!d2) { clearInterval(autoScrollRef.current); return }
            const r2 = c2.getBoundingClientRect()
            const nx = snapToGrid(Math.max(0, tx - r2.left + c2.scrollLeft - d2.offsetX))
            const ny = snapToGrid(Math.max(0, ty - r2.top + c2.scrollTop - d2.offsetY))
            setTables(prev => prev.map(tb => tb.id === d2.id ? { ...tb, x: nx, y: ny } : tb))
          }, 16)
        }
      }

      const onEnd = () => {
        clearInterval(autoScrollRef.current)
        touchDragRef.current = null
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onEnd)
      }
      document.addEventListener('touchmove', onMove, { passive: false })
      document.addEventListener('touchend', onEnd)
      return
    }

    // Nije u edit modu — single / double tap
    e.stopPropagation()
    const now = Date.now()
    const last = lastTapRef.current
    if (last && last.id === tableId && now - last.time < 300) {
      // Double tap → edit mode
      setEditMode(tableId)
      setSelected(tableId)
      lastTapRef.current = null
    } else {
      lastTapRef.current = { id: tableId, time: now }
      setSelected(tableId)
    }
  }

  // ── Touch Resize ───────────────────────────────────────────
  const startResizeTouch = (e, tableId) => {
    e.stopPropagation()
    e.preventDefault()
    const table = tables.find(t => t.id === tableId)
    const touch = e.touches[0]
    touchResizeRef.current = {
      id: tableId,
      startX: touch.clientX,
      startY: touch.clientY,
      origW: table.width,
      origH: table.height,
    }
    const onMove = (ev) => {
      ev.preventDefault()
      const r = touchResizeRef.current
      if (!r) return
      const t = ev.touches[0]
      setTables(prev => prev.map(tb => tb.id === tableId ? {
        ...tb,
        width: snapToGrid(Math.max(MIN_SIZE, r.origW + t.clientX - r.startX)),
        height: snapToGrid(Math.max(MIN_SIZE, r.origH + t.clientY - r.startY)),
      } : tb))
    }
    const onEnd = () => {
      touchResizeRef.current = null
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
  }

  // ── Brisanje stola ────────────────────────────────────────
  const deleteTable = async (id) => {
    if (!confirm(t('tmeDeleteConfirm'))) return
    if (!id.startsWith('tmp-')) {
      await supabase.from('tables').delete().eq('id', id)
    }
    setTables(prev => prev.filter(tb => tb.id !== id))
    setSelected(null)
    setEditMode(null)
  }

  // ── Izmjena labele / sjedišta ──────────────────────────────
  const updateTableProp = (id, prop, value) => {
    setTables(prev => prev.map(tb => tb.id === id ? { ...tb, [prop]: value } : tb))
  }

  // ── Čuvanje u bazu ────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      for (const table of tables) {
        const payload = {
          restaurant_id: restaurant.id,
          layout_id: table.layout_id || currentLayoutId,
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
          setTables(prev => prev.map(tb => tb.id === table.id ? { ...data } : tb))
        } else {
          await supabase.from('tables').update(payload).eq('id', table.id)
        }
      }
      setSaveMsg(t('tmeSaved'))
    } catch (err) {
      setSaveMsg(t('tmeSaveErr'))
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const selectedTable = tables.find(tb => tb.id === selected)
  const currentLayout = layouts.find(l => l.id === currentLayoutId)

  if (loading) return <div className={styles.loading}>{t('tmeLoading')}</div>

  return (
    <div className={styles.wrap}>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button
            className={`${styles.toolBtn} ${mode === 'select' ? styles.toolBtnActive : ''}`}
            onClick={() => setMode('select')}
            title={t('tmeSelectTitle')}
          >
            ↖ {t('tmeSelect')}
          </button>
          <button
            className={`${styles.toolBtn} ${mode === 'add-rect' ? styles.toolBtnActive : ''}`}
            onClick={() => setMode('add-rect')}
            title={t('tmeRectTitle')}
          >
            ▢ {t('tmeRectTable')}
          </button>
          <button
            className={`${styles.toolBtn} ${mode === 'add-circle' ? styles.toolBtnActive : ''}`}
            onClick={() => setMode('add-circle')}
            title={t('tmeCircleTitle')}
          >
            ○ {t('tmeCircleTable')}
          </button>
        </div>
        <div className={styles.toolbarRight}>
          {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
          <button className={styles.btnSave} onClick={saveAll} disabled={saving}>
            {saving ? t('saving') : t('tmeSaveMap')}
          </button>
          <button className={styles.btnView} onClick={() => navigate('/admin/tables/view')}>
            {t('tmeWaiterView')} →
          </button>
        </div>
      </div>

      {/* Layout traka — izbor/akcije rasporeda */}
      <div className={styles.layoutBar}>
        <div className={styles.layoutSelectWrap}>
          <select
            className={styles.layoutSelect}
            value={currentLayoutId || ''}
            onChange={e => switchLayout(e.target.value)}
            disabled={layoutBusy}
          >
            {layouts.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}{l.is_active ? ` · ${t('tmeLayoutActive')}` : ''}
              </option>
            ))}
          </select>
          {currentLayout && !currentLayout.is_active && (
            <span className={styles.layoutDraftBadge}>{t('tmeLayoutDraft')}</span>
          )}
        </div>
        <div className={styles.layoutActions}>
          {currentLayout && !currentLayout.is_active && (
            <button className={styles.layoutBtn} onClick={activateLayout} disabled={layoutBusy}>
              ✓ {t('tmeActivateLayout')}
            </button>
          )}
          <button className={styles.layoutBtn} onClick={createLayout} disabled={layoutBusy}>
            + {t('tmeNewLayout')}
          </button>
          <button className={styles.layoutBtn} onClick={duplicateLayout} disabled={layoutBusy}>
            ⧉ {t('tmeDuplicateLayout')}
          </button>
          <button className={styles.layoutBtn} onClick={renameLayout} disabled={layoutBusy}>
            ✎ {t('tmeRenameLayout')}
          </button>
          <button
            className={styles.layoutBtnDanger}
            onClick={deleteLayout}
            disabled={layoutBusy || currentLayout?.is_active || layouts.length <= 1}
          >
            🗑 {t('tmeDeleteLayout')}
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

          {/* Minimalna veličina canvas sadržaja za scroll na mobilnom */}
          <div className={styles.canvasSpacer} />

          {/* Hint za mode */}
          {mode !== 'select' && (
            <div className={styles.canvasHint}>
              {t('tmeAddHint', { shape: mode === 'add-circle' ? t('tmeShapeCircle') : t('tmeShapeRect') })}
            </div>
          )}

          {/* Edit mode hint */}
          {editMode && (
            <div className={styles.editModeHint}>
              {t('tmeEditModeHint')}
            </div>
          )}

          {/* Stolovi */}
          {tables.map(table => (
            <div
              key={table.id}
              className={styles.tableWrap}
              style={{ left: table.x, top: table.y, width: table.width, height: table.height }}
            >
              {/* Stolice — sibling ISPOD tijela stola (niži z-index) */}
              {getSeatPositions(table.shape, table.width, table.height, table.seats).map((p, i) => (
                <div key={i} className={styles.seat} style={{ left: p.x, top: p.y }} />
              ))}

              <div
                className={[
                  styles.tableEl,
                  selected === table.id ? styles.tableElSelected : '',
                  editMode === table.id ? styles.tableElEditMode : '',
                  styles[`status-${table.status}`] || '',
                ].join(' ')}
                style={{ borderRadius: table.shape === 'circle' ? '50%' : 8 }}
                onMouseDown={(e) => startDrag(e, table.id)}
                onTouchStart={(e) => handleTableTouchStart(e, table.id)}
                onClick={(e) => { e.stopPropagation(); setSelected(table.id) }}
              >
                <div className={styles.tableLabel}>{table.label || `${t('anaTable')} ${table.number}`}</div>
                <div className={styles.tableSeats}>{table.seats} {t('tblSeats')}</div>

                {/* Resize handle */}
                {selected === table.id && (
                  <div
                    className={styles.resizeHandle}
                    onMouseDown={(e) => startResize(e, table.id)}
                    onTouchStart={editMode === table.id
                      ? (e) => startResizeTouch(e, table.id)
                      : undefined}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Properties panel */}
        <div className={styles.panel}>
          {selectedTable ? (
            <>
              <div className={styles.panelTitle}>{t('anaTable')} {selectedTable.number}</div>

              <div className={styles.field}>
                <label>{t('tmeName')}</label>
                <input
                  value={selectedTable.label || ''}
                  onChange={e => updateTableProp(selectedTable.id, 'label', e.target.value)}
                  placeholder={`${t('anaTable')} ${selectedTable.number}`}
                />
              </div>

              <div className={styles.field}>
                <label>{t('tmeSeatsCount')}</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={selectedTable.seats}
                  onChange={e => updateTableProp(selectedTable.id, 'seats', parseInt(e.target.value))}
                />
              </div>

              <div className={styles.field}>
                <label>{t('tmeShape')}</label>
                <div className={styles.shapeToggle}>
                  <button
                    className={selectedTable.shape === 'rect' ? styles.shapeActive : ''}
                    onClick={() => updateTableProp(selectedTable.id, 'shape', 'rect')}
                  >
                    ▢ {t('tmeSquare')}
                  </button>
                  <button
                    className={selectedTable.shape === 'circle' ? styles.shapeActive : ''}
                    onClick={() => updateTableProp(selectedTable.id, 'shape', 'circle')}
                  >
                    ○ {t('tmeCircle')}
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label>{t('tmeWidth')}</label>
                <input
                  type="number"
                  value={selectedTable.width}
                  onChange={e => updateTableProp(selectedTable.id, 'width', parseInt(e.target.value))}
                />
              </div>
              <div className={styles.field}>
                <label>{t('tmeHeight')}</label>
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
                  {t('tmeQRCode')}
                </button>
                <button
                  className={styles.btnDelete}
                  onClick={() => deleteTable(selectedTable.id)}
                >
                  {t('tmeDeleteTable')}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.panelEmpty}>
              <div className={styles.panelEmptyIcon}>🗺️</div>
              <div>{t('tmeClickToEdit')}</div>
              <div className={styles.panelLegend}>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.dotFree}`} /> {t('tblFree')}
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.dotOccupied}`} /> {t('tblOccupied')}
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.dotCalling}`} /> {t('tblCalling')}
                </div>
              </div>
            </div>
          )}

          {/* Lista stolova */}
          <div className={styles.tableList}>
            <div className={styles.tableListTitle}>{t('tmeAllTables', { count: tables.length })}</div>
            {tables.map(tb => (
              <div
                key={tb.id}
                className={`${styles.tableListItem} ${selected === tb.id ? styles.tableListItemActive : ''}`}
                onClick={() => setSelected(tb.id)}
              >
                <span className={`${styles.legendDot} ${styles[`dot${tb.status.charAt(0).toUpperCase() + tb.status.slice(1)}`]}`} />
                <span>{tb.label || `${t('anaTable')} ${tb.number}`}</span>
                <span className={styles.tableListSeats}>{tb.seats} {t('tblSeatsShort')}</span>
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
            <div className={styles.qrTitle}>{t('tmeQRTitle', { label: showQR.label || `${t('anaTable')} ${showQR.number}` })}</div>
            <div className={styles.qrUrl}>
              {`${window.location.origin}/${restaurant.slug}?table=${showQR.number}&qr=1`}
            </div>
            <div className={styles.qrBox}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/${restaurant.slug}?table=${showQR.number}&qr=1`)}`}
                alt={t('tmeQRCode')}
                width={200}
                height={200}
              />
            </div>
            <a
              href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${window.location.origin}/${restaurant.slug}?table=${showQR.number}&qr=1`)}`}
              download={`qr-sto-${showQR.number}.png`}
              className={styles.qrDownload}
            >
              {t('tmeDownloadQR')}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
