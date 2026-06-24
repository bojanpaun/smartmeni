import { supabase } from './supabase'

// Audit log — upis traga akcije preko RPC-a log_audit_event (SECURITY DEFINER).
// Actor (ko je) se izvodi iz auth.uid() na serveru → klijent ga NE MOŽE lažirati.
//
// Fire-and-forget: NIKAD ne smije srušiti ni blokirati glavni tok. Greška se samo
// loguje u konzolu (npr. mreža padne, RLS odbije) — korisnička akcija ide dalje.
//
// NIKAD ne stavljati lozinke/tajne/PII u `metadata`.
//
// Primjer:
//   logAudit({ restaurantId, action: 'invoice.storno', entityType: 'invoice',
//              entityId: id, summary: `Storno računa ${broj}`, metadata: { reason } })
export async function logAudit({
  restaurantId = null,
  action,
  entityType = null,
  entityId = null,
  summary = null,
  metadata = {},
} = {}) {
  if (!action) return null
  try {
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_action: action,
      p_restaurant_id: restaurantId,
      p_entity_type: entityType,
      p_entity_id: entityId != null ? String(entityId) : null,
      p_summary: summary,
      p_metadata: metadata || {},
    })
    if (error) { console.error('Audit log nije upisan:', error.message); return null }
    return data
  } catch (e) {
    console.error('Audit log greška:', e?.message ?? e)
    return null
  }
}
