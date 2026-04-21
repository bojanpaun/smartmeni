// ▶ Zamijeniti: src/modules/analytics/pages/AnalyticsPage.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './AnalyticsPage.module.css'

const PERIODS = [
  { key: 'today',   label: 'Danas' },
  { key: 'week',    label: '7 dana' },
  { key: 'month',   label: '30 dana' },
  { key: 'quarter', label: '90 dana' },
  { key: 'custom',  label: 'Prilagođeno' },
]

const DAYS_SR = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub']

const MATRIX_COLORS = {
  star:      { bg: '#e0f5ec', border: '#0d7a52', text: '#0a6343', label: '⭐ Star' },
  plow:      { bg: '#e8f0fe', border: '#378add', text: '#185fa5', label: '🐎 Plow Horse' },
  puzzle:    { bg: '#fff8e0', border: '#f5c400', text: '#7a5c00', label: '🧩 Puzzle' },
  dog:       { bg: '#fde0e0', border: '#f57a7a', text: '#c0392b', label: '🐕 Dog' },
}

function getDateRange(period, customStart, customEnd) {
  const now = new Date()
  const end = now.toISOString()
  let start
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(); break
    case 'week':
      start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(); break
    case 'month':
      start = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(); break
    case 'quarter':
      start = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(); break
    case 'custom':
      start = customStart ? new Date(customStart).toISOString() : new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
      return { start, end: customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : end }
    default:
      start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
  return { start, end }
}

function getPrevDateRange(period, customStart, customEnd) {
  const now = new Date()
  let days
  switch (period) {
    case 'today': days = 1; break
    case 'week': days = 7; break
    case 'month': days = 30; break
    case 'quarter': days = 90; break
    case 'custom':
      days = customStart && customEnd
        ? Math.ceil((new Date(customEnd) - new Date(customStart)) / (1000 * 60 * 60 * 24))
        : 7; break
    default: days = 7
  }
  return {
    start: new Date(now - days * 2 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date(now - days * 24 * 60 * 60 * 1000).toISOString(),
  }
}

// Koliko dana pokriva period
function periodDays(period, customStart, customEnd) {
  switch (period) {
    case 'today': return 1
    case 'week': return 7
    case 'month': return 30
    case 'quarter': return 90
    case 'custom':
      if (customStart && customEnd)
        return Math.max(1, Math.ceil((new Date(customEnd) - new Date(customStart)) / (1000 * 60 * 60 * 24)))
      return 7
    default: return 7
  }
}

function Trend({ current, prev }) {
  if (!prev || prev === 0) return null
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0) return <span className={styles.trendFlat}>→ 0%</span>
  return pct > 0
    ? <span className={styles.trendUp}>↑ {pct}%</span>
    : <span className={styles.trendDown}>↓ {Math.abs(pct)}%</span>
}

function BarChart({ data, valueKey, labelKey, color = '#0d7a52', formatValue }) {
  if (!data || data.length === 0) return <div className={styles.chartEmpty}>Nema podataka</div>
  const max = Math.max(...data.map(d => d[valueKey] || 0))
  return (
    <div className={styles.barChart}>
      {data.map((d, i) => (
        <div key={i} className={styles.barItem}>
          <div className={styles.barWrap}>
            <div
              className={styles.bar}
              style={{ height: max > 0 ? `${Math.max(4, (d[valueKey] / max) * 100)}%` : '4%', background: color }}
              title={`${d[labelKey]}: ${formatValue ? formatValue(d[valueKey]) : d[valueKey]}`}
            />
          </div>
          <div className={styles.barLabel}>{d[labelKey]}</div>
        </div>
      ))}
    </div>
  )
}

function HBar({ value, max, label, sub, color = '#0d7a52', badge }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2
  return (
    <div className={styles.hBarItem}>
      <div className={styles.hBarMeta}>
        <div className={styles.hBarLabelWrap}>
          <span className={styles.hBarLabel}>{label}</span>
          {badge && <span className={styles.hBarBadge}>{badge}</span>}
        </div>
        <span className={styles.hBarSub}>{sub}</span>
      </div>
      <div className={styles.hBarTrack}>
        <div className={styles.hBarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// Menu Engineering matrica
function MenuMatrix({ items }) {
  if (!items || items.length === 0) return null
  const stars = items.filter(i => i.category === 'star')
  const plows = items.filter(i => i.category === 'plow')
  const puzzles = items.filter(i => i.category === 'puzzle')
  const dogs = items.filter(i => i.category === 'dog')

  const Section = ({ cat, list }) => (
    <div className={styles.matrixCell} style={{ borderColor: MATRIX_COLORS[cat].border, background: MATRIX_COLORS[cat].bg }}>
      <div className={styles.matrixCellTitle} style={{ color: MATRIX_COLORS[cat].text }}>
        {MATRIX_COLORS[cat].label}
      </div>
      <div className={styles.matrixCellDesc} style={{ color: MATRIX_COLORS[cat].text }}>
        {cat === 'star' && 'Visoka popularnost + visoka marža → Zadrži i promoviši'}
        {cat === 'plow' && 'Visoka popularnost + niska marža → Povećaj cijenu ili smanji trošak'}
        {cat === 'puzzle' && 'Niska popularnost + visoka marža → Bolje pozicioniraj u meniju'}
        {cat === 'dog' && 'Niska popularnost + niska marža → Razmotri uklanjanje'}
      </div>
      {list.length === 0
        ? <div className={styles.matrixEmpty}>Nema jela</div>
        : list.map((item, i) => (
          <div key={i} className={styles.matrixItem}>
            <span className={styles.matrixItemName}>{item.name}</span>
            <span className={styles.matrixItemStats} style={{ color: MATRIX_COLORS[cat].text }}>
              {item.quantity} kom · {item.marginPct.toFixed(0)}% marža
            </span>
          </div>
        ))
      }
    </div>
  )

  return (
    <div className={styles.matrixGrid}>
      <div className={styles.matrixAxisY}>← Niska marža &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Visoka marža →</div>
      <div className={styles.matrixAxisX}>↑ Visoka popularnost</div>
      <div className={styles.matrixCells}>
        <Section cat="plow" list={plows} />
        <Section cat="star" list={stars} />
        <Section cat="dog" list={dogs} />
        <Section cat="puzzle" list={puzzles} />
      </div>
      <div className={styles.matrixAxisXBottom}>↓ Niska popularnost</div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { restaurant } = usePlatform()
  const [period, setPeriod] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [activeSection, setActiveSection] = useState('overview')
  // Za ručni unos troška rada (ako nema plata)
  const [manualLaborCost, setManualLaborCost] = useState('')

  useEffect(() => {
    if (restaurant) loadData()
  }, [restaurant, period, customStart, customEnd])

  const loadData = async () => {
    if (period === 'custom' && (!customStart || !customEnd)) return
    setLoading(true)

    const { start, end } = getDateRange(period, customStart, customEnd)
    const { start: pStart, end: pEnd } = getPrevDateRange(period, customStart, customEnd)
    const days = periodDays(period, customStart, customEnd)

    const [
      { data: orders },
      { data: prevOrders },
      { data: orderItems },
      { data: waiterReqs },
      { data: reservations },
      { data: inventoryMovs },
      { data: allInventoryMovs },
      { data: inventoryItems },
      { data: categories },
      { data: staffList },
      { data: menuItemIngredients },
      { data: tablesCount },
    ] = await Promise.all([
      supabase.from('orders').select('id, total, created_at, table_number, status, updated_at')
        .eq('restaurant_id', restaurant.id).gte('created_at', start).lte('created_at', end).neq('status', 'closed'),
      supabase.from('orders').select('id, total')
        .eq('restaurant_id', restaurant.id).gte('created_at', pStart).lte('created_at', pEnd).neq('status', 'closed'),
      supabase.from('order_items').select('name, quantity, price, menu_item_id, category_id, created_at')
        .eq('restaurant_id', restaurant.id).gte('created_at', start).lte('created_at', end),
      supabase.from('waiter_requests').select('id, created_at, resolved_at, is_resolved, request_type, table_number')
        .eq('restaurant_id', restaurant.id).gte('created_at', start).lte('created_at', end),
      supabase.from('reservations').select('id, table_number, status, source, created_at')
        .eq('restaurant_id', restaurant.id).gte('created_at', start).lte('created_at', end),
      supabase.from('inventory_movements').select('item_id, quantity, type, source, created_at, note')
        .eq('restaurant_id', restaurant.id).gte('created_at', start).lte('created_at', end),
      supabase.from('inventory_movements').select('item_id, quantity, type, source, created_at')
        .eq('restaurant_id', restaurant.id).order('created_at'),
      supabase.from('inventory_items').select('id, name, unit, cost_per_unit, quantity, min_quantity, updated_at')
        .eq('restaurant_id', restaurant.id),
      supabase.from('categories').select('id, name').eq('restaurant_id', restaurant.id),
      supabase.from('staff').select('id, email, wage_type, wage_amount, is_active')
        .eq('restaurant_id', restaurant.id).eq('is_active', true),
      supabase.from('menu_item_ingredients').select('menu_item_id, inventory_item_id, quantity'),
      supabase.from('tables').select('id').eq('restaurant_id', restaurant.id),
    ])

    const ordersData = orders || []
    const itemsData = orderItems || []
    const reqsData = waiterReqs || []
    const resData = reservations || []
    const movsData = inventoryMovs || []
    const allMovsData = allInventoryMovs || []
    const invItems = inventoryItems || []
    const catsData = categories || []
    const staff = staffList || []
    const ingredients = menuItemIngredients || []
    const numTables = (tablesCount || []).length

    // ── PRIHOD I TROŠKOVI ──────────────────────────────────────
    const totalRevenue = ordersData.reduce((s, o) => s + (parseFloat(o.total) || 0), 0)
    const prevRevenue = (prevOrders || []).reduce((s, o) => s + (parseFloat(o.total) || 0), 0)
    const totalOrders = ordersData.length
    const prevOrdersCount = (prevOrders || []).length
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const prevAvg = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0

    // Trošak namirnica iz pokreta
    const ingredientCost = movsData
      .filter(m => m.source === 'order' && m.type === 'out')
      .reduce((s, m) => {
        const inv = invItems.find(i => i.id === m.item_id)
        return s + (parseFloat(inv?.cost_per_unit || 0) * parseFloat(m.quantity || 0))
      }, 0)

    // Trošak rada — računamo iz plata zaposlenih za period
    const laborCost = staff.reduce((s, emp) => {
      const amt = parseFloat(emp.wage_amount || 0)
      if (emp.wage_type === 'hourly') {
        // Pretpostavljamo 8 sati po radnom danu
        return s + amt * 8 * days
      } else if (emp.wage_type === 'weekly') {
        return s + amt * (days / 7)
      } else { // monthly
        return s + amt * (days / 30)
      }
    }, 0)

    const hasWageData = staff.some(e => parseFloat(e.wage_amount || 0) > 0)
    const effectiveLaborCost = hasWageData ? laborCost : (parseFloat(manualLaborCost) || 0)
    const totalCosts = ingredientCost + effectiveLaborCost
    const operatingProfit = totalRevenue - totalCosts
    const operatingMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : null
    const laborPct = totalRevenue > 0 ? (effectiveLaborCost / totalRevenue) * 100 : null
    const foodCostPct = totalRevenue > 0 ? (ingredientCost / totalRevenue) * 100 : null

    // ── PRIHOD PO DANIMA ──────────────────────────────────────
    const dayMap = {}
    ordersData.forEach(o => {
      const day = o.created_at.slice(0, 10)
      if (!dayMap[day]) dayMap[day] = { day: '', revenue: 0, orders: 0 }
      dayMap[day].day = new Date(day + 'T12:00:00').toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' })
      dayMap[day].revenue += parseFloat(o.total) || 0
      dayMap[day].orders++
    })
    const dailyData = Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day))

    // ── SATI I DANI SEDMICE ───────────────────────────────────
    const hourMap = {}
    for (let h = 0; h < 24; h++) hourMap[h] = 0
    ordersData.forEach(o => { hourMap[new Date(o.created_at).getHours()]++ })
    const hourlyData = Object.entries(hourMap)
      .map(([h, c]) => ({ hour: `${h}h`, count: c, h: parseInt(h) }))
      .filter(d => d.h >= 7 && d.h <= 23)

    const weekdayMap = {}
    DAYS_SR.forEach((d, i) => { weekdayMap[i] = { day: d, count: 0, revenue: 0 } })
    ordersData.forEach(o => {
      const wd = new Date(o.created_at).getDay()
      weekdayMap[wd].count++
      weekdayMap[wd].revenue += parseFloat(o.total) || 0
    })
    const weekdayData = Object.values(weekdayMap)

    // ── MENU ENGINEERING MATRICA ──────────────────────────────
    // Skupljamo prodaju i trošak po menu_item_id
    const menuItemMap = {}
    itemsData.forEach(item => {
      const key = item.menu_item_id || item.name
      if (!menuItemMap[key]) menuItemMap[key] = {
        name: item.name,
        menu_item_id: item.menu_item_id,
        quantity: 0,
        revenue: 0,
        hasRecipe: ingredients.some(ing => ing.menu_item_id === item.menu_item_id),
      }
      menuItemMap[key].quantity += item.quantity || 1
      menuItemMap[key].revenue += (parseFloat(item.price) || 0) * (item.quantity || 1)
    })

    // Trošak po jelu iz recepture
    const menuItems = Object.values(menuItemMap).map(item => {
      if (!item.hasRecipe || !item.menu_item_id) return { ...item, cost: null, marginPct: null }
      const itemIngredients = ingredients.filter(ing => ing.menu_item_id === item.menu_item_id)
      const costPerPortion = itemIngredients.reduce((s, ing) => {
        const inv = invItems.find(i => i.id === ing.inventory_item_id)
        return s + (parseFloat(inv?.cost_per_unit || 0) * parseFloat(ing.quantity || 0))
      }, 0)
      const totalCostForItem = costPerPortion * item.quantity
      const margin = item.revenue > 0 ? ((item.revenue - totalCostForItem) / item.revenue) * 100 : 0
      return { ...item, cost: totalCostForItem, costPerPortion, marginPct: margin }
    })

    const itemsWithRecipe = menuItems.filter(i => i.marginPct !== null && i.quantity > 0)
    const noRecipeItems = menuItems.filter(i => i.marginPct === null && i.quantity > 0)
    const hasMenuMatrix = itemsWithRecipe.length > 0

    // Medijane za matricu
    let matrixItems = []
    if (hasMenuMatrix) {
      const avgQty = itemsWithRecipe.reduce((s, i) => s + i.quantity, 0) / itemsWithRecipe.length
      const avgMargin = itemsWithRecipe.reduce((s, i) => s + i.marginPct, 0) / itemsWithRecipe.length
      matrixItems = itemsWithRecipe.map(item => ({
        ...item,
        category:
          item.quantity >= avgQty && item.marginPct >= avgMargin ? 'star' :
          item.quantity >= avgQty && item.marginPct < avgMargin  ? 'plow' :
          item.quantity < avgQty  && item.marginPct >= avgMargin ? 'puzzle' : 'dog',
      }))
    }

    // ── TOP JELA + KATEGORIJE ─────────────────────────────────
    const itemNameMap = {}
    itemsData.forEach(item => {
      if (!itemNameMap[item.name]) itemNameMap[item.name] = { name: item.name, quantity: 0, revenue: 0 }
      itemNameMap[item.name].quantity += item.quantity || 1
      itemNameMap[item.name].revenue += (parseFloat(item.price) || 0) * (item.quantity || 1)
    })
    const topItems = Object.values(itemNameMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10)

    const catMap = {}
    catsData.forEach(c => { catMap[c.id] = { name: c.name, revenue: 0, cost: 0, quantity: 0 } })
    itemsData.forEach(item => {
      if (item.category_id && catMap[item.category_id]) {
        catMap[item.category_id].revenue += (parseFloat(item.price) || 0) * (item.quantity || 1)
        catMap[item.category_id].quantity += item.quantity || 1
      }
    })
    const catData = Object.values(catMap).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue)

    // ── INVENTAR ANALITIKA ────────────────────────────────────
    // Potrošnja namirnica
    const ingMap = {}
    movsData.filter(m => m.type === 'out').forEach(m => {
      const inv = invItems.find(i => i.id === m.item_id)
      if (!inv) return
      if (!ingMap[m.item_id]) ingMap[m.item_id] = { name: inv.name, unit: inv.unit, consumed: 0, cost: 0, costPerUnit: parseFloat(inv.cost_per_unit || 0) }
      ingMap[m.item_id].consumed += parseFloat(m.quantity) || 0
      ingMap[m.item_id].cost += parseFloat(inv.cost_per_unit || 0) * (parseFloat(m.quantity) || 0)
    })

    // Dopune (ulazi)
    const replenishMap = {}
    movsData.filter(m => m.type === 'in').forEach(m => {
      const inv = invItems.find(i => i.id === m.item_id)
      if (!inv) return
      if (!replenishMap[m.item_id]) replenishMap[m.item_id] = { name: inv.name, unit: inv.unit, quantity: 0, cost: 0, count: 0 }
      replenishMap[m.item_id].quantity += parseFloat(m.quantity) || 0
      replenishMap[m.item_id].cost += parseFloat(inv.cost_per_unit || 0) * (parseFloat(m.quantity) || 0)
      replenishMap[m.item_id].count++
    })

    // Rashodi (ručni izlazi — ne od narudžbi)
    const wasteMap = {}
    movsData.filter(m => m.type === 'out' && m.source === 'manual').forEach(m => {
      const inv = invItems.find(i => i.id === m.item_id)
      if (!inv) return
      if (!wasteMap[m.item_id]) wasteMap[m.item_id] = { name: inv.name, unit: inv.unit, quantity: 0, cost: 0, count: 0 }
      wasteMap[m.item_id].quantity += parseFloat(m.quantity) || 0
      wasteMap[m.item_id].cost += parseFloat(inv.cost_per_unit || 0) * (parseFloat(m.quantity) || 0)
      wasteMap[m.item_id].count++
    })

    // Brzina potrošnje (dani do isteka na osnovu prosječne dnevne potrošnje)
    const topConsumed = Object.values(ingMap).sort((a, b) => b.cost - a.cost).slice(0, 10)
    const topReplenish = Object.values(replenishMap).sort((a, b) => b.cost - a.cost).slice(0, 8)
    const topWaste = Object.values(wasteMap).sort((a, b) => b.cost - a.cost)

    // Zarobljeni kapital — stavke ispod minimuma ili bez potrošnje
    const frozenCapital = invItems.filter(i => {
      const consumed = ingMap[i.id]?.consumed || 0
      return consumed === 0 && parseFloat(i.quantity) > 0
    }).map(i => ({
      name: i.name,
      unit: i.unit,
      quantity: parseFloat(i.quantity),
      value: parseFloat(i.quantity) * parseFloat(i.cost_per_unit || 0),
    })).filter(i => i.value > 0).sort((a, b) => b.value - a.value)

    // Stopa rotacije (consumed / avg_stock)
    const inventoryTurnover = invItems.map(i => {
      const consumed = ingMap[i.id]?.consumed || 0
      const avgStock = parseFloat(i.quantity) + consumed / 2
      const turnover = avgStock > 0 ? (consumed / avgStock) : 0
      const daysToEmpty = consumed > 0 ? (parseFloat(i.quantity) / (consumed / days)) : null
      return { ...i, consumed, turnover, daysToEmpty }
    }).filter(i => i.consumed > 0 || parseFloat(i.quantity) > 0)

    // ── STOLOVI ───────────────────────────────────────────────
    const tableMap = {}
    ordersData.forEach(o => {
      const t = o.table_number ? `Sto ${o.table_number}` : 'Nepoznat'
      if (!tableMap[t]) tableMap[t] = { table: t, orders: 0, revenue: 0, reservations: 0 }
      tableMap[t].orders++
      tableMap[t].revenue += parseFloat(o.total) || 0
    })
    resData.filter(r => r.status === 'confirmed').forEach(r => {
      const t = r.table_number ? `Sto ${r.table_number}` : 'Nepoznat'
      if (!tableMap[t]) tableMap[t] = { table: t, orders: 0, revenue: 0, reservations: 0 }
      tableMap[t].reservations++
    })
    const topTables = Object.values(tableMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
    const uniqueOccupiedTables = new Set(ordersData.map(o => o.table_number)).size
    const occupancyRate = numTables > 0 ? (uniqueOccupiedTables / numTables) * 100 : 0

    // ── OSOBLJE ───────────────────────────────────────────────
    const totalReqs = reqsData.length
    const resolvedReqs = reqsData.filter(r => r.is_resolved).length
    const avgResolveTime = reqsData.filter(r => r.is_resolved && r.resolved_at)
      .reduce((s, r) => s + (new Date(r.resolved_at) - new Date(r.created_at)) / 60000, 0) / (resolvedReqs || 1)
    const reqTypeMap = {}
    reqsData.forEach(r => {
      if (!reqTypeMap[r.request_type]) reqTypeMap[r.request_type] = 0
      reqTypeMap[r.request_type]++
    })
    const topReqTypes = Object.entries(reqTypeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)

    const servedOrders = ordersData.filter(o => o.status === 'served' && o.updated_at)
    const avgServiceTime = servedOrders.length > 0
      ? servedOrders.reduce((s, o) => s + (new Date(o.updated_at) - new Date(o.created_at)) / 60000, 0) / servedOrders.length
      : null

    const confirmedRes = resData.filter(r => r.status === 'confirmed')

    setData({
      totalRevenue, prevRevenue, totalOrders, prevOrdersCount,
      avgOrder, prevAvg, ingredientCost, laborCost: effectiveLaborCost,
      hasWageData, totalCosts, operatingProfit, operatingMargin,
      laborPct, foodCostPct, dailyData, hourlyData, weekdayData,
      topItems, catData,
      matrixItems, hasMenuMatrix, noRecipeItems,
      topConsumed, topReplenish, topWaste, frozenCapital, inventoryTurnover,
      topTables, occupancyRate, numTables, uniqueOccupiedTables,
      totalReqs, resolvedReqs, avgResolveTime, topReqTypes, avgServiceTime,
      staff, days,
      onlineRes: confirmedRes.filter(r => r.source === 'online').length,
      adminRes: confirmedRes.filter(r => r.source === 'admin').length,
      totalRes: confirmedRes.length,
    })
    setLoading(false)
  }

  const SECTIONS = [
    { key: 'overview',  label: 'Pregled' },
    { key: 'menu',      label: 'Meni' },
    { key: 'inventory', label: 'Namirnice' },
    { key: 'tables',    label: 'Stolovi' },
    { key: 'staff',     label: 'Osoblje' },
  ]

  if (loading && !data) return <div className={styles.loading}>Učitavanje analitike...</div>
  if (!data) return null

  const d = data
  const maxItem = d.topItems[0]?.quantity || 1
  const maxTable = d.topTables[0]?.revenue || 1
  const maxConsumed = d.topConsumed[0]?.cost || 1
  const maxReplenish = d.topReplenish[0]?.cost || 1
  const maxWaste = d.topWaste[0]?.cost || 1
  const maxReqType = d.topReqTypes[0]?.count || 1

  return (
    <div className={styles.wrap}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>Analitika</div>
        <div className={styles.periodTabs}>
          {PERIODS.map(p => (
            <button key={p.key}
              className={`${styles.periodTab} ${period === p.key ? styles.periodTabActive : ''}`}
              onClick={() => setPeriod(p.key)}>{p.label}</button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className={styles.customPicker}>
          <div className={styles.customPickerField}>
            <label>Od</label>
            <input type="date" value={customStart} max={customEnd || undefined} onChange={e => setCustomStart(e.target.value)} />
          </div>
          <div className={styles.customPickerField}>
            <label>Do</label>
            <input type="date" value={customEnd} min={customStart || undefined} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      <div className={styles.sectionTabs}>
        {SECTIONS.map(s => (
          <button key={s.key}
            className={`${styles.sectionTab} ${activeSection === s.key ? styles.sectionTabActive : ''}`}
            onClick={() => setActiveSection(s.key)}>{s.label}</button>
        ))}
      </div>

      {/* ── PREGLED ── */}
      {activeSection === 'overview' && (
        <>
          {/* Operativna profitabilnost */}
          <div className={styles.profitCard}>
            <div className={styles.profitTitle}>Operativna profitabilnost</div>
            <div className={styles.profitRow}>
              <div className={styles.profitItem}>
                <div className={styles.profitLabel}>Ukupan prihod</div>
                <div className={styles.profitValue}>€{d.totalRevenue.toFixed(2)}</div>
                <Trend current={d.totalRevenue} prev={d.prevRevenue} />
              </div>
              <div className={styles.profitMinus}>−</div>
              <div className={styles.profitItem}>
                <div className={styles.profitLabel}>Trošak namirnica</div>
                <div className={styles.profitValue}>€{d.ingredientCost.toFixed(2)}</div>
                {d.foodCostPct !== null && <div className={styles.profitPct}>{d.foodCostPct.toFixed(1)}% prihoda</div>}
              </div>
              <div className={styles.profitMinus}>−</div>
              <div className={styles.profitItem}>
                <div className={styles.profitLabel}>Trošak rada</div>
                <div className={styles.profitValue}>€{d.laborCost.toFixed(2)}</div>
                {d.laborPct !== null && <div className={styles.profitPct}>{d.laborPct.toFixed(1)}% prihoda</div>}
              </div>
              <div className={styles.profitEquals}>=</div>
              <div className={`${styles.profitItem} ${styles.profitResult}`}>
                <div className={styles.profitLabel}>Operativni profit</div>
                <div className={`${styles.profitValue} ${d.operatingProfit >= 0 ? styles.profitPos : styles.profitNeg}`}>
                  €{d.operatingProfit.toFixed(2)}
                </div>
                {d.operatingMargin !== null && (
                  <div className={`${styles.profitPct} ${d.operatingMargin >= 0 ? styles.profitPos : styles.profitNeg}`}>
                    {d.operatingMargin.toFixed(1)}% marža
                  </div>
                )}
              </div>
            </div>
            {!d.hasWageData && (
              <div className={styles.profitNote}>
                ℹ️ Plate zaposlenih nijesu definisane.
                <button className={styles.linkBtn} onClick={() => setActiveSection('staff')}>Unesi ručno →</button>
              </div>
            )}
          </div>

          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Broj narudžbi</div>
              <div className={styles.kpiValue}>{d.totalOrders}</div>
              <Trend current={d.totalOrders} prev={d.prevOrdersCount} />
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Prosječna narudžba</div>
              <div className={styles.kpiValue}>€{d.avgOrder.toFixed(2)}</div>
              <Trend current={d.avgOrder} prev={d.prevAvg} />
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Popunjenost stolova</div>
              <div className={styles.kpiValue}>{d.occupancyRate.toFixed(0)}%</div>
              <div className={styles.kpiSub}>{d.uniqueOccupiedTables} od {d.numTables} stolova</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Prosj. čekanje</div>
              <div className={styles.kpiValue}>{d.avgServiceTime !== null ? `${d.avgServiceTime.toFixed(0)} min` : '—'}</div>
              <div className={styles.kpiSub}>od narudžbe do servisa</div>
            </div>
          </div>

          {d.dailyData.length > 1 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Prihod po danima</div>
              <BarChart data={d.dailyData} valueKey="revenue" labelKey="day" color="#0d7a52" formatValue={v => `€${v.toFixed(2)}`} />
            </div>
          )}

          <div className={styles.twoCol}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Najprometniji sati</div>
              <BarChart data={d.hourlyData} valueKey="count" labelKey="hour" color="#378add" />
            </div>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Aktivnost po danima sedmice</div>
              <BarChart data={d.weekdayData} valueKey="count" labelKey="day" color="#7f77dd" />
            </div>
          </div>
        </>
      )}

      {/* ── MENI ── */}
      {activeSection === 'menu' && (
        <>
          {/* Menu Engineering matrica */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Menu Engineering matrica (Plow Horse / Star / Dog / Puzzle)</div>
            <div className={styles.sectionDesc}>
              Matrica kategorizuje jela prema popularnosti (broj prodaja) i marži (profitabilnosti). Samo jela sa definisanim recepturama.
            </div>
            {!d.hasMenuMatrix ? (
              <div className={styles.warningBox}>
                ⚠️ Nema jela sa definisanim recepturama. Definiši recepture u modulu <strong>Zalihe → Recepture</strong> da biste koristili menu engineering.
              </div>
            ) : (
              <>
                {d.noRecipeItems.length > 0 && (
                  <div className={styles.infoBox}>
                    ℹ️ {d.noRecipeItems.length} {d.noRecipeItems.length === 1 ? 'jelo nema' : 'jela nemaju'} definisanu recepturu i nijesu uključena u matricu:
                    {' '}{d.noRecipeItems.map(i => i.name).join(', ')}
                  </div>
                )}
                <MenuMatrix items={d.matrixItems} />
              </>
            )}
          </div>

          {/* Top jela */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Najprodavanija jela</div>
            {d.topItems.length === 0 ? <div className={styles.empty}>Nema podataka.</div> : (
              <div className={styles.itemsTable}>
                <div className={styles.itemsHeader}>
                  <span>#</span><span>Naziv</span><span>Prodano</span><span>Prihod</span><span></span>
                </div>
                {d.topItems.map((item, i) => (
                  <div key={i} className={styles.itemRow}>
                    <span className={`${styles.itemRank} ${i < 3 ? styles[`rank${i+1}`] : ''}`}>{i + 1}</span>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemQty}>{item.quantity} kom</span>
                    <span className={styles.itemRevenue}>€{item.revenue.toFixed(2)}</span>
                    <div className={styles.itemBar}>
                      <div className={styles.itemBarFill} style={{ width: `${(item.quantity / maxItem) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kategorije */}
          {d.catData.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Prihod po kategoriji</div>
              <div className={styles.hBarList}>
                {d.catData.map((cat, i) => (
                  <HBar key={i} value={cat.revenue} max={d.catData[0]?.revenue || 1}
                    label={cat.name} sub={`€${cat.revenue.toFixed(2)} · ${cat.quantity} prodano`} color="#0d7a52" />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── NAMIRNICE ── */}
      {activeSection === 'inventory' && (
        <>
          <div className={styles.twoCol}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Ukupni trošak namirnica</div>
              <div className={styles.kpiValue}>€{d.ingredientCost.toFixed(2)}</div>
              {d.foodCostPct !== null && <div className={styles.kpiSub}>{d.foodCostPct.toFixed(1)}% od prihoda</div>}
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Zarobljeni kapital</div>
              <div className={styles.kpiValue}>€{d.frozenCapital.reduce((s, i) => s + i.value, 0).toFixed(2)}</div>
              <div className={styles.kpiSub}>{d.frozenCapital.length} stavki bez potrošnje u periodu</div>
            </div>
          </div>

          {/* Najpopularnije namirnice */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Najpopularnije namirnice (po trošku)</div>
            {d.topConsumed.length === 0
              ? <div className={styles.empty}>Nema podataka — definišite recepture u modulu Zalihe.</div>
              : <div className={styles.hBarList}>
                  {d.topConsumed.map((ing, i) => (
                    <HBar key={i} value={ing.cost} max={maxConsumed}
                      label={ing.name}
                      sub={`${ing.consumed.toFixed(3)} ${ing.unit} · €${ing.cost.toFixed(2)}`}
                      color="#ef9f27" />
                  ))}
                </div>
            }
          </div>

          <div className={styles.twoCol}>
            {/* Dopune zaliha */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Dopune zaliha (ulazi)</div>
              {d.topReplenish.length === 0
                ? <div className={styles.empty}>Nema ulaza u odabranom periodu.</div>
                : <div className={styles.hBarList}>
                    {d.topReplenish.map((ing, i) => (
                      <HBar key={i} value={ing.cost} max={maxReplenish}
                        label={ing.name}
                        sub={`${ing.count}× · ${ing.quantity.toFixed(2)} ${ing.unit} · €${ing.cost.toFixed(2)}`}
                        color="#0d7a52" />
                    ))}
                  </div>
              }
            </div>

            {/* Rashodi */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Rashodi i ručni izlazi</div>
              {d.topWaste.length === 0
                ? <div className={styles.empty}>Nema ručnih izlaza u odabranom periodu.</div>
                : <div className={styles.hBarList}>
                    {d.topWaste.map((ing, i) => (
                      <HBar key={i} value={ing.cost} max={maxWaste}
                        label={ing.name}
                        sub={`${ing.count}× · ${ing.quantity.toFixed(2)} ${ing.unit} · €${ing.cost.toFixed(2)}`}
                        color="#c0392b" />
                    ))}
                  </div>
              }
            </div>
          </div>

          {/* Zarobljeni kapital */}
          {d.frozenCapital.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Zarobljeni kapital — stavke bez potrošnje</div>
              <div className={styles.sectionDesc}>Namirnice koje su na zalihama ali se nisu trošile u odabranom periodu.</div>
              <div className={styles.frozenList}>
                {d.frozenCapital.map((item, i) => (
                  <div key={i} className={styles.frozenItem}>
                    <span className={styles.frozenName}>{item.name}</span>
                    <span className={styles.frozenQty}>{item.quantity.toFixed(2)} {item.unit}</span>
                    <span className={styles.frozenValue}>€{item.value.toFixed(2)}</span>
                  </div>
                ))}
                <div className={styles.frozenTotal}>
                  <span>Ukupno zarobljeno</span>
                  <span></span>
                  <span className={styles.frozenTotalVal}>
                    €{d.frozenCapital.reduce((s, i) => s + i.value, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Brzina potrošnje */}
          {d.inventoryTurnover.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Brzina potrošnje — dani do isteka</div>
              <div className={styles.sectionDesc}>Na osnovu prosječne dnevne potrošnje u periodu.</div>
              <div className={styles.turnoverTable}>
                <div className={styles.turnoverHeader}>
                  <span>Namirnica</span><span>Na zalihi</span><span>Potrošeno</span><span>Dani do isteka</span>
                </div>
                {d.inventoryTurnover
                  .filter(i => i.consumed > 0)
                  .sort((a, b) => (a.daysToEmpty || 999) - (b.daysToEmpty || 999))
                  .slice(0, 12)
                  .map((item, i) => (
                    <div key={i} className={`${styles.turnoverRow} ${item.daysToEmpty !== null && item.daysToEmpty < 3 ? styles.turnoverRowLow : ''}`}>
                      <span>{item.name}</span>
                      <span>{parseFloat(item.quantity).toFixed(2)} {item.unit}</span>
                      <span>{item.consumed.toFixed(2)} {item.unit}</span>
                      <span className={item.daysToEmpty !== null && item.daysToEmpty < 3 ? styles.lowDays : ''}>
                        {item.daysToEmpty !== null ? `~${item.daysToEmpty.toFixed(0)} dana` : '—'}
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STOLOVI ── */}
      {activeSection === 'tables' && (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Stopa popunjenosti</div>
              <div className={styles.kpiValue}>{d.occupancyRate.toFixed(0)}%</div>
              <div className={styles.kpiSub}>{d.uniqueOccupiedTables} od {d.numTables} stolova</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Rezervacije ukupno</div>
              <div className={styles.kpiValue}>{d.totalRes}</div>
              <div className={styles.kpiSub}>{d.onlineRes} online · {d.adminRes} lično</div>
            </div>
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Prihod i rezervacije po stolu</div>
            {d.topTables.length === 0 ? <div className={styles.empty}>Nema podataka.</div> : (
              <div className={styles.hBarList}>
                {d.topTables.map((t, i) => (
                  <HBar key={i} value={t.revenue} max={maxTable}
                    label={t.table}
                    sub={`€${t.revenue.toFixed(2)} · ${t.orders} narudžbi`}
                    badge={t.reservations > 0 ? `${t.reservations} rez.` : null}
                    color="#0d7a52" />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── OSOBLJE ── */}
      {activeSection === 'staff' && (
        <>
          {/* Trošak rada */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Trošak rada za period ({d.days} dana)</div>
            {d.staff.length === 0 ? (
              <div className={styles.empty}>Nema aktivnog osoblja. Dodaj zaposlenike u modulu Osoblje.</div>
            ) : (
              <div className={styles.staffTable}>
                <div className={styles.staffHeader}>
                  <span>Zaposlenik</span><span>Tip plate</span><span>Iznos</span><span>Za period</span>
                </div>
                {d.staff.map((emp, i) => {
                  const amt = parseFloat(emp.wage_amount || 0)
                  let forPeriod = 0
                  if (emp.wage_type === 'hourly') forPeriod = amt * 8 * d.days
                  else if (emp.wage_type === 'weekly') forPeriod = amt * (d.days / 7)
                  else forPeriod = amt * (d.days / 30)
                  return (
                    <div key={i} className={styles.staffRow}>
                      <span>{emp.email}</span>
                      <span className={styles.staffWageType}>
                        {emp.wage_type === 'hourly' ? 'Po satu' : emp.wage_type === 'weekly' ? 'Sedmično' : 'Mjesečno'}
                      </span>
                      <span>€{amt.toFixed(2)}</span>
                      <span className={styles.staffForPeriod}>€{forPeriod.toFixed(2)}</span>
                    </div>
                  )
                })}
                <div className={styles.staffTotal}>
                  <span>Ukupno za period</span><span></span><span></span>
                  <span>€{d.laborCost.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Ručni unos ako nema plata */}
            {!d.hasWageData && (
              <div className={styles.manualLaborWrap}>
                <div className={styles.manualLaborTitle}>Ručni unos troška rada</div>
                <div className={styles.manualLaborRow}>
                  <input
                    type="number" min="0" step="0.01"
                    className={styles.manualLaborInput}
                    placeholder="Ukupni trošak rada (€)"
                    value={manualLaborCost}
                    onChange={e => setManualLaborCost(e.target.value)}
                  />
                  <button className={styles.manualLaborBtn} onClick={() => loadData()}>
                    Primijeni
                  </button>
                </div>
                <div className={styles.manualLaborNote}>
                  Ili definiši plate zaposlenika u modulu <strong>Osoblje → Zaposleni</strong> (uredi zaposlenika → tip i iznos plate).
                </div>
              </div>
            )}

            {d.laborPct !== null && d.laborCost > 0 && (
              <div className={styles.laborMetrics}>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabel}>Trošak rada / prihod</div>
                  <div className={styles.kpiValue}>{d.laborPct.toFixed(1)}%</div>
                  <div className={styles.kpiSub}>{d.laborPct < 30 ? 'Odlično (ispod 30%)' : d.laborPct < 35 ? 'Prihvatljivo (30–35%)' : 'Visoko (iznad 35%)'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Zahtjevi konobara */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Ukupno zahtjeva</div>
              <div className={styles.kpiValue}>{d.totalReqs}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Riješeno</div>
              <div className={styles.kpiValue}>{d.resolvedReqs}</div>
              <div className={styles.kpiSub}>{d.totalReqs > 0 ? `${((d.resolvedReqs/d.totalReqs)*100).toFixed(0)}% stopa` : '—'}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Prosj. odgovor</div>
              <div className={styles.kpiValue}>{d.avgResolveTime > 0 ? `${d.avgResolveTime.toFixed(0)} min` : '—'}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Prosj. serviranje</div>
              <div className={styles.kpiValue}>{d.avgServiceTime !== null ? `${d.avgServiceTime.toFixed(0)} min` : '—'}</div>
            </div>
          </div>

          {d.topReqTypes.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Najčešći zahtjevi</div>
              <div className={styles.hBarList}>
                {d.topReqTypes.map((r, i) => (
                  <HBar key={i} value={r.count} max={maxReqType}
                    label={r.type} sub={`${r.count} zahtjeva`} color="#534ab7" />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
