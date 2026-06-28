# rest.by.me — Strategija: hardver, štampa i platforma

> Status: **NACRT za odluku** (2026-06-28). Ne implementirati ništa odavde bez eksplicitne potvrde.
> Ulazni kontekst: tržište = **šire/EU** (fiskalizacija pluggable po zemlji), tenant = **miješano**
> (od kafića do hotela), offline = **poželjan ali ne blokira**.

## 0. Polazna teza (zašto ovaj dokument postoji)

Problem nije tehnički nego **pozicioni**: tenanti pitaju „koji hardver i kako fiskalizacija",
i ta pitanja vuku ka terenskoj podršci — što je suprotno inicijalnoj ideji (sve preko neta,
imaš nalog → imaš sve, podrška kroz aplikaciju bez izlaska na teren).

**Ključno razdvajanje:**
- *Hardver postoji* u ugostiteljstvu (printer, fioka, terminal) — neizbježno, nije mana app-a.
- *Hardver NE mora značiti teren.* Teren ubija **nestandardizovan** hardver (svaki tenant donese
  nasumičan uređaj pa se ručno šteluje). Lijek: **kratka lista podržanih uređaja + web čarobnjak
  za setup + cloud štampa.** Tako rade Square / Loyverse / Toast / Lightspeed — nula tehničara.

**Posljedica:** cilj nije „bez hardvera" nego **daljinski-instalabilan, standardizovan hardver.**

---

## 1. Platformska odluka — PWA-first (jedan kod)

Pošto offline NIJE blokirajući, nema razloga za tri zasebne native aplikacije (Windows/iOS/Android).
To je trostruko održavanje za tim 1 dev + Claude. Umjesto toga:

| Cilj | Rješenje | Status |
|---|---|---|
| Desktop Windows | PWA „Instaliraj aplikaciju" (Edge/Chrome) | već imamo PWA infrastrukturu |
| Android | PWA instalacija + push (radi) | isto |
| iOS/iPadOS | PWA instalacija + push (iOS 16.4+) | isto |
| Tablet POS osjećaj (kuhinja/konobar/recepcija) | web app na tabletu (`/admin/kitchen`, `/admin/waiter`, front desk) | već postoji |

**Native ljuska se NE piše ponovo — omotava se isti React app, samo ako/kad zatreba:**
- **Capacitor** → iOS/Android, za native plugine (Bluetooth/USB printer, dublji offline)
- **Tauri** (lakši) ili Electron → Windows desktop, ako zatreba lokalni agent zapakovan uz app

**Odluka-kapija za native:** ulazimo u Capacitor/Tauri tek kad se pojavi *konkretan* blocker koji
PWA ne može (npr. obavezan Bluetooth termalni printer kod terenske prodaje, ili tvrdi offline POS).
Do tada — PWA.

### Šta PWA daje, a šta ne (iskreno)
- ✅ Instalacija na sve 3 platforme, push notifikacije, ikonica, cache za čitanje, brz start.
- ⚠️ Direktan pristup USB/serijskom printeru: **samo desktop Chrome/Edge** (Web Serial/USB), ne iOS.
- ⚠️ Tvrdi offline POS (kucanje narudžbi danima bez neta sa lokalnom bazom i sync-om) — granica PWA;
  rješava se tek native ljuskom + lokalnim storage-om. Pošto offline nije blokirajući → odgađa se.

---

## 2. Arhitektura štampe (najvažnija hardverska odluka)

Browser ne može da otvori sirovi TCP na mrežni printer (port 9100) — pa „samo dajte mrežni printer"
ne radi iz web app-a. Realne opcije:

| Pristup | Kako radi | Za nas | Mane |
|---|---|---|---|
| **Cloud print (CloudPRNT / Server Direct Print)** | Printer SAM povlači poslove sa našeg servera preko HTTPS | **PRIMARNI** — nula lokalnog softvera, radi kroz NAT/firewall, idealno za daljinsku podršku i više lokacija | Traži određene modele (Star mC-Print, Epson Server Direct), ~2–5s poll latencija, printer treba internet |
| **Web Serial / WebUSB** | Browser → USB printer direktno | **SEKUNDARNI** — za desktop terminale, instant, besplatno | Samo Chrome/Edge desktop, dozvola po uređaju, USB kabl, ne na iOS |
| **Lokalni print agent** | Mali program na terminalu prima poslove i štampa na LAN/USB | **ZADNJA OPCIJA** — radi sa bilo kojim printerom | Lokalna instalacija (protiv „bez terena" ideje), održavanje |
| Mrežni printer direktno iz browsera | — | **NE postoji** (browser nema raw TCP) | isključeno |

**Preporuka:** CloudPRNT primarno (najbolje pristaje viziji), Web Serial kao desktop fallback,
lokalni agent samo ako tenant ima zatečen nepodržan printer i ne želi da ga mijenja.

---

## 3. Hardverska matrica po modulu

Legenda: **[N]** neophodno za puni UX · **[O]** opciono/po potrebi · **[0]** nula hardvera

### Restoran
| Stavka | Nivo | Napomena |
|---|---|---|
| Termalni printer računa 80mm (cloud-capable) | **[N]** | dine-in računi + fiskalni isječak; srce setupa |
| Kasa-fioka | **[O]** | otvara se preko kick-porta printera (vezana za printer, ne zaseban kabl) |
| Kuhinjski/bar printer **ILI** KDS | **[O]** | KDS = tablet/monitor sa `/admin/kitchen` (jeftinije, bez lock-ina) vs fizički kuhinjski printer |
| POS terminal za kartice | **[O]** | standalone (banka/SumUp/Monri) ili SoftPOS (tap-to-pay na Android telefonu) |
| QR meni | **[0]** | već imamo, gost skenira svojim telefonom |
| Barkod skener / label printer | **[O]** | retail/zalihe, rijetko za čistu ugostiteljsku |

### Hotel
| Stavka | Nivo | Napomena |
|---|---|---|
| Računar/tablet na recepciji | **[N]** | bilo koji — web app, bez specijalnog hardvera |
| Printer računa/fakture | **[O]** | može dijeliti isti cloud printer |
| POS terminal za kartice | **[O]** | kao restoran |
| Ključ-kartice / brave | **[O]** | **najveća kompleksnost** — vidi dolje |
| ID/pasoš skener | **[O]** | ručni unos radi; skener ubrzava prijavu |

**Brave/ključevi — fazno:** (1) fizički ključ = nula integracije; (2) standalone smart brave
(TTLock/Igloohome — kod/app, bez integracije, samokod za self check-in) = realan sljedeći korak kao
addon; (3) integrisani sistemi (SALTO/Vingcard) = složeno, odgoditi dok ne bude tražnje.

### Najam (rental)
| Stavka | Nivo | Napomena |
|---|---|---|
| Bilo koji uređaj sa browserom | **[N]** | uglavnom nula namjenskog hardvera |
| Smart brava (self check-in) | **[O]** | dijeli logiku sa hotelskim bravama (kasnije) |
| Printer | **[O]** | rijetko |

### Dijeljeno (sve vertikale)
| Stavka | Nivo | Napomena |
|---|---|---|
| Stabilan internet/ruter | **[N]** | jedini stvarni univerzalni zahtjev |
| 4G/LTE failover ruter | **[O]** | jeftino ublažava prekide BEZ koda (djelimičan „offline" odgovor) |

---

## 4. Fiskalizacija i kartice (po zemlji, pluggable)

- **Fiskalizacija ide ka softveru, ne hardveru.** CG (Fisver), Srbija, Hrvatska — online model:
  pošalješ podatke računa na API poreske, dobiješ potpis/QR. To je **sertifikat + integracija**,
  ne hardverska fiskalna kasa. → ide u prilog „sve preko neta".
- Arhitektura već postoji u planu: `_shared/fiscalization/` (univerzalno jezgro + country adapter,
  ME=Fisver prvi). Za EU perspektivu: svaka zemlja = novi adapter, bez diranja jezgra.
- **Kartice:** odluka standalone terminal vs SoftPOS vs integrisani. Za miješane tenante najlakše:
  podrži standalone (tenant ima bankarski terminal) + ponudi SoftPOS kao opciju. Online plaćanja
  (booking/folio) već idu kroz `payments/` apstrakciju (Stripe/Monri).
- **Otvoreno (blokira FISK):** tačna ME pravila (numbering format, Fisver cijena/hosting, certifikat
  onboarding) — već zavedeno u roadmapu kao BLOCKING.

---

## 5. Playbook daljinske podrške (kako bez terena)

1. **Objavljena lista kompatibilnih uređaja** + „kupi ovo" linkovi (po nivou tenanta).
2. **Self-serve čarobnjak po uređaju:** printer se uparuje CloudPRNT registracionim kodom iz
   `/admin/settings`; sve podešavanje u app-u.
3. Tenant kupuje hardver sam (preporučeni modeli) — stiže plug-and-play.
4. **Podrška = screen-share + in-app help + FAQ**, ne izlazak na teren.
5. Eskalacija na teren samo za izuzetke (zatečen nestandardan hardver) — i to je naplativa opcija,
   ne podrazumijevano.

---

## 6. Predloženi redoslijed (faze — još bez koda)

| Faza | Sadržaj | Trud | Vrijednost |
|---|---|---|---|
| **0. Sadržaj** | Objaviti listu podržanog hardvera + vodič za kupovinu (FAQ/landing) | nizak | odmah gasi tenant pitanja, 0 dev |
| **1. Štampa računa (CloudPRNT)** | Najvrednija integracija — čarobnjak u postavkama, render računa → cloud printer | srednji | otključava dine-in/fiskalni tok |
| **2. Web Serial fallback** | Direktna USB štampa za desktop terminale | nizak-srednji | pokriva tenante bez cloud printera |
| **3. Kartice** | Odluka standalone vs SoftPOS + uputstva/integracija | srednji | in-person naplata |
| **4. Fiskalizacija (FISK)** | Već planirano; softver, veže se na štampu | visok | zakonska usklađenost |
| **kasnije** | KDS dorada, smart brave (addon), native ljuska (ako zatreba) | — | po tražnji |

**Logika:** Faza 0 rješava tvoj *trenutni* problem (pitanja tenanata) bez ijednog reda koda.
Tek onda gradimo štampu kao prvu pravu hardversku integraciju.

---

## 7. Odluke koje čekaju tebe

1. **Faza 0 odmah?** Da napravim listu podržanog hardvera + vodič kao prvi konkretan korak (sadržaj,
   ne kod)?
2. **Printer-vendor pravac:** ciljamo Star (CloudPRNT zrelo) ili Epson (Server Direct), ili oba?
3. **KDS:** fizički kuhinjski printer ili tablet-KDS kao preporučeni default?
4. **Kartice:** forsiramo SoftPOS (jeftino, bez terminala) ili standalone terminal kao default?
5. **Native:** potvrđujemo „PWA-first, native tek na konkretan blocker" kao zvaničan kurs?
