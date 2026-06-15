-- ============================================================================
-- Faza WO (2/2 šema) — staff-scoped UPDATE RLS na orders + order_items
-- ----------------------------------------------------------------------------
-- ⚠️ KRITIČNO / popravlja postojeći bug, ne samo preduslov za novi unos.
-- StaffPortal loguje svako osoblje VLASTITIM nalogom (supabase.auth.signInWithPassword),
-- pa je auth.uid() = nalog konobara, NE vlasnika. Sve dosadašnje UPDATE politike na
-- orders/order_items su owner-only (auth.uid() = restaurants.user_id) — uključujući
-- pogrešno imenovanu "Osoblje upravlja stavkama" (koja je zapravo owner-check).
-- Posljedica: za osoblje koje nije vlasnik TIHO padaju (0 redova, bez greške):
-- promjena statusa narudžbe, odbijanje, charge-to-room order-update, te
-- kitchen_status/bar_status iz KitchenView/BarView.
--
-- Dodajemo staff-scoped UPDATE (membership obrazac koji već koristе hotel_core/
-- housekeeping/spa/breakfast). Permisivne politike se OR-uju s postojećim owner
-- politikama (vlasnik i dalje radi). INSERT/SELECT ostaju otvoreni (gost piše kao anon).
-- Time RPC waiter_submit_order može biti SECURITY INVOKER (CLAUDE.md: DEFINER samo za anon).
-- Test: supabase/tests/052_orders_staff_rls.sql
-- ============================================================================

CREATE POLICY "Osoblje azurira narudzbe" ON public.orders
  FOR UPDATE TO authenticated
  USING      (restaurant_id IN (SELECT restaurant_id FROM public.staff
                                WHERE user_id = auth.uid() AND is_active))
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM public.staff
                                WHERE user_id = auth.uid() AND is_active));

CREATE POLICY "Osoblje azurira stavke" ON public.order_items
  FOR UPDATE TO authenticated
  USING      (restaurant_id IN (SELECT restaurant_id FROM public.staff
                                WHERE user_id = auth.uid() AND is_active))
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM public.staff
                                WHERE user_id = auth.uid() AND is_active));
