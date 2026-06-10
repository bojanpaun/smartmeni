-- ============================================================================
-- FAQ dopuna — nove funkcionalnosti: vodiči za podešavanje, online plaćanja,
-- tema/dark mode, promjena lozinke. (support_faq je platform-global, RLS:
-- superadmin manage / authenticated read published.)
-- ============================================================================

INSERT INTO support_faq (question, answer, category, sort_order, is_published) VALUES
  ('Kako da ponovo pokrenem vodič za podešavanje?',
   'Na kontrolnoj tabli (/admin), pored naslova sekcije „Restoran" ili „Hotel" klikni link „📋 Vodič". Vodič te vodi kroz osnovno podešavanje (profil, meni / tipovi soba i sobe). Možeš ga pokrenuti bilo kad — neće duplirati podatke koje već imaš.',
   'ostalo', 60, true),

  ('Kako da omogućim online plaćanje gostiju (booking/folio)?',
   'Hotel → Plaćanja (/admin/hotel/payment) → „Dodaj provajder". Izaberi Monri ili Stripe, mod „Test", pa unesi ključeve koje dobiješ od provajdera (modal ti pokazuje gdje ih naći i tačan callback URL koji lijepiš u njihov dashboard). Aktiviraj i postavi kao „Default". Dok provajder nije postavljen, rezervacije se kreiraju bez online naplate.',
   'placanja', 10, true),

  ('Koji payment provajder da koristim u Crnoj Gori?',
   'Za firme registrovane u Crnoj Gori koristi se Monri (preko domaće banke) — Stripe nije dostupan za CG pravna lica. Stripe se može koristiti za testiranje ili za firme registrovane u zemljama koje Stripe podržava.',
   'placanja', 20, true),

  ('Kako da promijenim temu i boje admin panela?',
   'Tema (zelena/plava/ljubičasta ili custom paleta) postavlja se po tenantu iz superadmin panela: /superadmin → uredi tenant → „🎨 Tema". Superadmin može kreirati i vlastite palete na /superadmin/theme (Custom palete).',
   'ostalo', 70, true),

  ('Kako da uključim tamni režim (dark mode)?',
   'U sidebaru (lijevo) klikni prekidač ☀️/🌙. Tamni režim je po korisniku i pamti se. Radi uz svaku paletu (zelena/plava/ljubičasta/custom).',
   'ostalo', 71, true),

  ('Kako da promijenim svoju lozinku?',
   'Moj nalog (/admin/account) → kartica „Promjena lozinke". Ako si zaboravio lozinku dok nisi prijavljen, na ekranu za prijavu klikni „Zaboravili ste lozinku?" za reset putem emaila.',
   'osoblje', 80, true);
