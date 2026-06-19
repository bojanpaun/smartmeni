import { supabase } from './supabase'

// Zajednička logika „koji su stolovi zauzeti" — da gost (OnlineReservationForm) i
// admin (ReservationsPage/TablePicker) ne razilaze u pravilima (§8.3 spec).
//
// Gost zove sa `time` i statusima ['pending','confirmed'] (precizno po terminu);
// admin zove BEZ `time` i sa ['confirmed'] (grublje, namjerno permisivnije — admin
// svjesno smije preklopiti). Ponašanje nepromijenjeno u odnosu na prije refaktora.
export async function getReservedTableIds(
  restaurantId, date, time = null, statuses = ['pending', 'confirmed'],
) {
  if (!restaurantId || !date) return new Set()
  let q = supabase.from('reservations').select('table_id')
    .eq('restaurant_id', restaurantId).eq('date', date).in('status', statuses)
  if (time) q = q.eq('time', time)
  const { data } = await q
  return new Set((data || []).map(r => r.table_id).filter(Boolean))
}

// §8.4 OVERLAY (bez marker-rezervacija): stolovi koje zauzima POTVRĐEN event na dati
// datum — preko event_guests.table_id (rasjeđeni gosti). Vraća prazno ako nema eventa.
// Napomena: blokira samo kad event koristi stolove koji su u istom (aktivnom) layoutu
// koji rezervacijski pogledi prikazuju — na dan eventa kad je event-layout aktivan.
export async function getEventTableIds(restaurantId, date) {
  if (!restaurantId || !date) return new Set()
  const { data: evs } = await supabase.from('events').select('id')
    .eq('restaurant_id', restaurantId).eq('date', date).eq('status', 'confirmed')
  const ids = (evs || []).map(e => e.id)
  if (ids.length === 0) return new Set()
  const { data: egs } = await supabase.from('event_guests').select('table_id').in('event_id', ids)
  return new Set((egs || []).map(g => g.table_id).filter(Boolean))
}
