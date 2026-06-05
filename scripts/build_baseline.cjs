#!/usr/bin/env node
/*
 * build_baseline.cjs — generiše baseline migraciju iz remote dumpa.
 * Izvlači SAMO objekte 24 baznih tabela (as-of-20260528) + sve funkcije.
 * Bazne tabele nijedna postojeća migracija ne kreira; ovo ih kreira PRIJE 20260528.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'supabase', '_remote_schema_snapshot.sql');
const OUT = path.join(ROOT, 'supabase', 'migrations', '20260527000000_baseline_schema.sql');

const BASE = new Set([
  'restaurants','staff','staff_absences','staff_history','staff_invites','roles',
  'user_profiles','guests','guest_visits','categories','menu_items','menu_item_ingredients',
  'orders','order_items','tables','reservations','waiter_requests','work_schedules',
  'attendance','attendance_entries','payroll_entries','payroll_periods',
  'inventory_items','inventory_movements',
]);
// Tabele koje POSTOJEĆE migracije kreiraju → ne diramo ih ovdje (i FK na njih izbacujemo).
const MIGRATION_TBL = new Set([
  'addon_catalog','booking_payments','folio_items','folios','guest_requests','hotel_reservations',
  'housekeeping_tasks','landing_pages','maintenance_requests','payment_credentials','payment_transactions',
  'rate_plan_rooms','rate_plans','room_availability','room_types','rooms','seasonal_rates',
  'spa_appointments','spa_packages','spa_pricing_rules','spa_retail_items','spa_rooms','spa_services',
  'spa_settings','spa_therapist_services','spa_therapists','staff_announcements','staff_roles',
  'subscriptions','tenant_payment_configs',
  // views
  'hotel_daily_revenue','spa_analytics_monthly',
]);

// Objekti koje moramo izostaviti (kasnije dodani; FK ordering / kolone koje migracije dodaju).
const EXCLUDE_INDEX = new Set(['idx_orders_folio']);            // referencira orders.folio_id (FK na folios)
const EXCLUDE_TRIGGER = new Set(['trg_order_link_guest']);      // UPDATE OF folio_id — kolona se dodaje migracijom

const sql = fs.readFileSync(SRC, 'utf8');

// --- Splitter koji poštuje $$...$$ dollar-quoting ---
function splitStatements(text) {
  const stmts = [];
  let i = 0, start = 0, n = text.length;
  let dollarTag = null; // npr. '$$' ili '$tag$'
  while (i < n) {
    if (dollarTag) {
      if (text.startsWith(dollarTag, i)) { i += dollarTag.length; dollarTag = null; continue; }
      i++; continue;
    }
    // detektuj početak dollar-quote: $ [tag] $
    if (text[i] === '$') {
      const m = /^\$[A-Za-z_0-9]*\$/.exec(text.slice(i));
      if (m) { dollarTag = m[0]; i += m[0].length; continue; }
    }
    if (text[i] === ';') {
      stmts.push(text.slice(start, i + 1));
      i++; start = i; continue;
    }
    i++;
  }
  if (start < n && text.slice(start).trim()) stmts.push(text.slice(start));
  return stmts;
}

const statements = splitStatements(sql);

const groups = {
  functions: [], tables: [], constraints: [], fks: [], indexes: [],
  policies: [], triggers: [], grants: [],
};
// Funkcije se ne uključuju sve (migracije ih redefinišu sa promjenom return tipa
// → "cannot change return type"). Skupljamo ih po imenu, pa emitujemo SAMO one
// koje zadržani bazni trigeri zovu.
const funcCreate = new Map();   // name -> CREATE FUNCTION izjava
const funcOwner  = new Map();   // name -> ALTER FUNCTION OWNER izjava
const reFuncName = /(?:CREATE OR REPLACE FUNCTION|CREATE FUNCTION|ALTER FUNCTION) "public"\."([a-z_]+)"/;

const reTableRef = /"public"\."([a-z_]+)"/;          // prva public tabela u izjavi
const reCreateTable = /CREATE TABLE(?: IF NOT EXISTS)? "public"\."([a-z_]+)"/;
const reAlterOwner = /ALTER TABLE "public"\."([a-z_]+)" OWNER TO/;
const reComment = /COMMENT ON (?:TABLE|COLUMN) "public"\."([a-z_]+)"/;
const reAddConstraint = /ALTER TABLE ONLY "public"\."([a-z_]+)"\s+ADD CONSTRAINT/;
const reFk = /REFERENCES "(\w+)"\."(\w+)"/;
const reIndex = /CREATE (?:UNIQUE )?INDEX "([a-z_]+)" ON "public"\."([a-z_]+)"/;
const rePolicy = /CREATE POLICY ".*?" ON "public"\."([a-z_]+)"/s;
const reTrigger = /CREATE (?:OR REPLACE )?TRIGGER "([a-z_]+)"[\s\S]*? ON "public"\."([a-z_]+)"/;
const reGrant = /GRANT .* ON TABLE "public"\."([a-z_]+)"/s;

function stripOrdersFolioId(block) {
  return block.split('\n').filter(l => !/^\s*"folio_id" "uuid",\s*$/.test(l)).join('\n');
}

for (const raw of statements) {
  const s = raw.trim();
  if (!s) continue;

  // Funkcije — skupljamo po imenu; biramo kasnije samo potrebne
  if (/^CREATE OR REPLACE FUNCTION|^CREATE FUNCTION/.test(s)) {
    const fm = reFuncName.exec(s); if (fm) funcCreate.set(fm[1], s); continue;
  }
  if (/^ALTER FUNCTION/.test(s)) {
    const fm = reFuncName.exec(s); if (fm) funcOwner.set(fm[1], s); continue;
  }
  // Pogledi — preskoči (migracije ih kreiraju)
  if (/^CREATE (?:OR REPLACE )?VIEW/.test(s)) continue;

  let m;
  if ((m = reCreateTable.exec(s))) {
    const t = m[1];
    if (BASE.has(t)) {
      let block = s;
      if (t === 'orders') block = stripOrdersFolioId(block);
      groups.tables.push(block);
    }
    continue;
  }
  if ((m = reAlterOwner.exec(s))) {
    if (BASE.has(m[1])) groups.tables.push(s);
    continue;
  }
  if ((m = reComment.exec(s))) {
    if (BASE.has(m[1])) groups.tables.push(s);
    continue;
  }
  if ((m = reAddConstraint.exec(s))) {
    const t = m[1];
    if (!BASE.has(t)) continue;
    if (/FOREIGN KEY/.test(s)) {
      const fk = reFk.exec(s);
      if (fk) {
        const [, schema, target] = fk;
        if (schema === 'public' && MIGRATION_TBL.has(target)) continue; // npr. orders->folios
      }
      groups.fks.push(s);
    } else {
      groups.constraints.push(s); // PRIMARY KEY / UNIQUE
    }
    continue;
  }
  if ((m = reIndex.exec(s))) {
    const [, idxName, t] = m;
    if (BASE.has(t) && !EXCLUDE_INDEX.has(idxName)) groups.indexes.push(s);
    continue;
  }
  if ((m = rePolicy.exec(s))) {
    if (BASE.has(m[1])) groups.policies.push(s);
    continue;
  }
  if ((m = reTrigger.exec(s))) {
    const [, name, t] = m;
    if (BASE.has(t) && !EXCLUDE_TRIGGER.has(name)) groups.triggers.push(s);
    continue;
  }
  if (/^GRANT/.test(s) && (m = reGrant.exec(s))) {
    if (BASE.has(m[1])) groups.grants.push(s);
    continue;
  }
  // sve ostalo (SET, schema, sequence grants, default privileges, replica identity migr. tbl) — preskoči
}

// Funkcije: samo one koje zadržani bazni trigeri zovu (EXECUTE FUNCTION ...)
const neededFns = new Set();
const reExecFn = /EXECUTE FUNCTION "public"\."([a-z_]+)"/;
for (const trg of groups.triggers) {
  const em = reExecFn.exec(trg);
  if (em) neededFns.add(em[1]);
}
for (const name of [...neededFns].sort()) {
  if (funcCreate.has(name)) groups.functions.push(funcCreate.get(name));
  if (funcOwner.has(name))  groups.functions.push(funcOwner.get(name));
}

// ENABLE RLS za sve bazne tabele (event trigger rls_auto_enable nije u dumpu → eksplicitno)
const enableRls = [...BASE].sort().map(
  t => `ALTER TABLE "public"."${t}" ENABLE ROW LEVEL SECURITY;`
).join('\n');

const header = `-- ============================================================================
-- BASELINE ŠEMA — bazne (legacy) tabele platforme/restorana
-- ----------------------------------------------------------------------------
-- Generisano iz prod dumpa (supabase/_remote_schema_snapshot.sql) skriptom
-- scripts/build_baseline.cjs. Kreira 24 bazne tabele koje NIJEDNA migracija ne
-- kreira (restaurants, staff, guests, orders, menu_items, ...), a koje sve
-- migracije od 20260528 nadalje pretpostavljaju da postoje. Bez ovoga
-- 'supabase db reset' / 'supabase test db' pucaju na FK ka nepostojećim tabelama.
--
-- As-of-20260528: orders.folio_id je IZOSTAVLJEN (dodaje ga 20260528000005 sa
-- FK na folios); kitchen_status/bar_status/categories.is_bar su zadržani jer ih
-- kasnije migracije dodaju idempotentno (ADD COLUMN IF NOT EXISTS).
--
-- Event trigger 'rls_auto_enable' ne postoji lokalno → RLS uključujemo eksplicitno.
-- NE EDITOVATI RUČNO — regeneriši skriptom ako treba.
-- ============================================================================

SET check_function_bodies = false;
SET client_min_messages = warning;

-- Ekstenzije koje su u prod-u predinstalirane (Supabase managed). Lokalno/CI ih
-- moramo eksplicitno uključiti da kasnije cron/net migracije (spa reminder) prođu.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
`;

const sections = [
  ['-- ── Funkcije ────────────────────────────────────────────────────────────', groups.functions],
  ['-- ── Tabele ──────────────────────────────────────────────────────────────', groups.tables],
  ['-- ── Primarni / Unique ključevi ──────────────────────────────────────────', groups.constraints],
  ['-- ── Strani ključevi (samo ka baznim tabelama / auth.users) ───────────────', groups.fks],
  ['-- ── Indeksi ─────────────────────────────────────────────────────────────', groups.indexes],
  ['-- ── RLS (eksplicitno uključenje) ─────────────────────────────────────────', [enableRls]],
  ['-- ── RLS politike ────────────────────────────────────────────────────────', groups.policies],
  ['-- ── Trigeri ─────────────────────────────────────────────────────────────', groups.triggers],
  ['-- ── Grantovi (anon/authenticated/service_role) ──────────────────────────', groups.grants],
];

let out = header + '\n';
for (const [title, items] of sections) {
  if (!items.length) continue;
  out += '\n' + title + '\n\n';
  out += items.map(x => x.trim().endsWith(';') ? x.trim() : x.trim() + ';').join('\n\n') + '\n';
}

fs.writeFileSync(OUT, out, 'utf8');

const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
console.log('Baseline napisan:', OUT);
console.log('Brojevi:', JSON.stringify(counts, null, 0));
console.log('Ukupno izjava:', sql.length, 'znakova ->', out.length, 'znakova');
