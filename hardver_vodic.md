# rest.by.me — Vodič za hardver (Faza 0)

> Status: **NACRT — sadržaj, bez koda** (2026-06-28). Cilj: dati tenantu jasan odgovor
> „šta da kupim" i prebaciti podršku sa terena na daljinu. Izvor strategije:
> [[hardver_i_platforma_strategija.md]].
>
> ⚠️ **Modeli i cijene su indikativni** (znanje + tipično EU/Balkan tržište) — prije objave
> validirati dostupnost i cijenu kod lokalnog distributera. Tabele su namijenjene da kasnije
> postanu in-app stranica / FAQ unosi.

## Usvojene default odluke (potvrditi)

Da bi vodič bio konkretan, pretpostavljeno je sljedeće (lako se mijenja):

| # | Odluka | Pretpostavka | Zašto |
|---|---|---|---|
| 2 | Vendor printera | **Star primarno** (CloudPRNT zreo), Epson alternativa | cloud-first štampa bez lokalnog softvera |
| 3 | KDS | **Tablet-KDS default** (`/admin/kitchen`), kuhinjski printer opciono | jeftinije, bez lock-ina, koristi postojeći ekran |
| 4 | Kartice | **SoftPOS default za male**, standalone terminal za one koji ga već imaju | najniži ulazni trošak, bez namjenskog terminala |
| 5 | Platforma | **PWA-first**, native tek na konkretan blocker | jedan kod za Win/iOS/Android |

---

## Šta ti NE treba (da raščistimo odmah)

- ❌ **Namjenska fiskalna kasa (hardverska).** Fiskalizacija ide softverski/online (sertifikat + API).
- ❌ **Proprietarni POS hardver** zaključan za jednog proizvođača.
- ❌ **Server u lokalu / „instalacija" tehničara.** Sve se podešava iz `/admin` u browseru.
- ❌ **Poseban računar samo za app.** Radi na bilo kom uređaju sa modernim browserom.

Treba ti samo: **uređaj sa browserom + internet + (po potrebi) standardizovan printer/terminal.**

---

## Nivoi setupa (tenant je miješan — biraš po veličini)

### 🟢 Nivo 0 — Minimum (kafić, mali objekat, apartman/najam)
| Uređaj | Preporuka | Indik. cijena | Napomena |
|---|---|---|---|
| Terminal | Postojeći telefon / tablet / laptop | 0 | Chrome/Edge na desktopu = i USB štampa |
| Printer računa (opciono) | Star TSP143IV (CloudPRNT) ili bez printera | ~120–180 € | mnogi mali rade i bez — QR/elektronski račun |
| Kartice (opciono) | SoftPOS (tap na Android) ili SumUp/myPOS čitač | 0–40 € | bez namjenskog terminala |
| Internet | Postojeći Wi-Fi | 0 | — |

**Poenta:** Nivo 0 može startovati **bez ijednog kupljenog uređaja** (QR meni + naplata gotovina/SoftPOS).

### 🟡 Nivo 1 — Standardni restoran (kuhinja + bar, dine-in)
| Uređaj | Preporuka | Indik. cijena | Napomena |
|---|---|---|---|
| Terminal (šank/kasa) | Tablet 10"+ ili mini-PC | 150–400 € | jedan ili više |
| Printer računa | **Star mC-Print3** (CloudPRNT, USB/LAN/BT, DK port) | ~200–260 € | srce setupa; ima port za fioku |
| Kasa-fioka | Generička RJ11/12 kick-fioka | 40–80 € | otvara je printer, ne zaseban kabl |
| Kuhinja/bar | **Tablet-KDS** (`/admin/kitchen`, `/admin/bar`) **ili** Epson/Star LAN kuhinjski printer | 150 € (tablet) / 180–250 € (printer) | KDS default; printer ako kuhinja traži papir |
| Kartice | SoftPOS ili standalone bankarski/SumUp terminal | 0–150 € | — |
| Internet + backup | Ruter + **4G/LTE failover** | 30–120 € | ublažava prekide bez koda |

### 🔵 Nivo 2 — Hotel / veći objekat
| Uređaj | Preporuka | Indik. cijena | Napomena |
|---|---|---|---|
| Recepcija | Računar ili tablet | 300–700 € | web app, bez specijalnog hardvera |
| Printer računa/fakture | Star mC-Print3 / Epson TM-m30III | ~200–280 € | može dijeliti sa restoranom |
| Kartice | Standalone terminal (recepcija) ili SoftPOS | 0–200 € | — |
| Ključ-kartice / brave (opciono) | Smart brave (TTLock/Igloohome/Nuki) — kod/app | 80–200 €/vrata | bez centralne integracije; self check-in kasnije kao addon |
| ID/pasoš skener (opciono) | Bilo koji dokument skener | 100–300 € | ručni unos radi i bez |
| Internet + backup | Ruter + 4G failover | 30–120 € | — |

---

## Štampa — kako se povezuje (bez tehničara)

1. **Cloud printer (preporučeno):** kupiš CloudPRNT model (Star mC-Print/TSP143IV), uključiš ga na
   internet, u `/admin/settings` upišeš registracioni kod → printer sam povlači račune. Radi sa više
   lokacija i kroz firewall.
2. **USB na desktop terminalu:** Chrome/Edge → Web Serial/USB, dozvoliš uređaj jednom. Bez cloud-a,
   ali samo desktop browser.
3. **Zatečen nepodržan printer:** lokalni print-agent kao zadnja opcija (izbjegavamo).

---

## Kartice i fiskalizacija (ukratko za tenanta)

- **Online plaćanja** (booking/folio/web): već u aplikaciji preko provajdera (Stripe/Monri) — nula
  hardvera.
- **Plaćanje karticom na licu mjesta:** SoftPOS (tap na Android telefonu) ili standalone terminal.
- **Fiskalizacija:** softverska, po zemlji (sertifikat + poreski API). Nema hardverske kase. Detalji
  i status po zemlji: faza FISK.

---

## Naredni korak (poslije potvrde default odluka)

- [ ] Potvrditi default odluke #2–#5 (gore).
- [ ] Validirati 3–4 konkretna modela kod lokalnog distributera (cijena/dostupnost).
- [ ] Pretočiti ovaj vodič u **in-app stranicu** (`/admin/help/hardver` ili sekcija na landing-u) +
      sažete **FAQ unose** (support_faq) — to je prvi mali dev korak Faze 0.
- [ ] (Faza 1) CloudPRNT integracija — čarobnjak za uparivanje printera u postavkama.
