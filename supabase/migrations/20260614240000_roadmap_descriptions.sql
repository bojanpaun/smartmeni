-- ============================================================================
-- platform_roadmap — dopuna opisa: gdje funkcionalnost VEĆ postoji a planira se
-- nadogradnja, kratko navesti šta postoji i šta se dodatno razvija (jasnije laiku).
-- ============================================================================

UPDATE public.platform_roadmap SET description =
  'Računi sa PDV obračunom već postoje; dodajemo povezivanje s poreskom upravom — fiskalni broj, QR kod na računu i poreski izvještaji.'
 WHERE title = 'Fiskalizacija računa (Crna Gora)';

UPDATE public.platform_roadmap SET description =
  'Online rezervacije već rade; dodajemo plaćanje karticom direktno na vašoj stranici — bez provizije posrednika.'
 WHERE title = 'Online plaćanje rezervacija';

UPDATE public.platform_roadmap SET description =
  'Inventar i recepti već postoje; dodajemo evidenciju dobavljača, narudžbenice i popis zaliha (inventura) za precizniju kontrolu troškova.'
 WHERE title = 'Inventar — dobavljači i inventura';

UPDATE public.platform_roadmap SET description =
  'Email obavještenja već postoje; dodajemo automatske kampanje — zahvalnica nakon boravka, čestitka za rođendan i ponude za povratak.'
 WHERE title = 'Automatske email kampanje';

UPDATE public.platform_roadmap SET description =
  'Hotel modul već radi (sobe, rezervacije, folio); dodajemo narudžbe na sobu (room service), grupne rezervacije i listu čekanja.'
 WHERE title = 'Hotel — room service i grupe';

UPDATE public.platform_roadmap SET description =
  'HR i obračun plata već postoje; dodajemo obuke zaposlenih, ocjenjivanje učinka i čuvanje dokumenata osoblja.'
 WHERE title = 'HR — obuke i učinak';

UPDATE public.platform_roadmap SET description =
  'Booking engine za direktne rezervacije postoji; dodajemo automatsku sinhronizaciju termina i cijena sa Booking.com, Airbnb i drugim kanalima.'
 WHERE title = 'Channel manager';

UPDATE public.platform_roadmap SET description =
  'Loyalty je nova funkcionalnost povrh postojećih profila gostiju: bodovi, nivoi i posebne ponude, povezano sa narudžbama i računima.'
 WHERE title = 'Loyalty program';
