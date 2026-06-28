-- ============================================================================
-- FAQ: prebaci hardverske unose u zasebnu kategoriju „hardver" (vlastiti pill na
-- /admin/support). Ranije su bili razbacani po 'ostalo'/'placanja'/'rezervacije'.
-- Identifikacija po tačnom pitanju (stabilno; sort_order nije jedinstven).
-- ============================================================================

UPDATE public.support_faq SET category = 'hardver'
WHERE question IN (
  'Koji hardver mi treba da koristim aplikaciju?',
  'Treba li mi fiskalna kasa (hardver)?',
  'Koji printer za račune da kupim?',
  'Kako da naplaćujem kartice?',
  'Treba li mi poseban računar ili instalacija/tehničar?',
  'Šta mi treba za hotel (recepcija, ključevi)?'
);
