# SmartMeni 🍽️

Digitalni meni za restorane u Crnoj Gori. Besplatno.

## Struktura projekta

```
smartmeni/
├── src/
│   ├── pages/
│   │   ├── Landing.jsx        ← Landing page (smartmeni.me)
│   │   ├── Landing.module.css
│   │   ├── Menu.jsx           ← Meni za goste (smartmeni.me/demo)
│   │   └── Menu.module.css
│   ├── App.jsx                ← Router
│   ├── main.jsx               ← Entry point
│   └── index.css              ← Global stilovi
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Pokretanje lokalno

```bash
npm install
npm run dev
```

Otvori http://localhost:5173

- Landing page: http://localhost:5173/
- Demo meni: http://localhost:5173/demo

## Deploy na Vercel

### Opcija 1 — Automatski (preporučeno)

1. Puši kod na GitHub:
```bash
git init
git add .
git commit -m "Initial commit — SmartMeni MVP"
git remote add origin https://github.com/TVOJ_USERNAME/smartmeni.git
git push -u origin main
```

2. Idi na vercel.com → "Add New Project"
3. Poveži GitHub repozitorij
4. Vercel automatski detektuje Vite — klikni Deploy
5. Za 60 sekundi sajt je online!

### Opcija 2 — Vercel CLI

```bash
npm i -g vercel
vercel
```

## Sljedeće faze

- [ ] Faza 3: Supabase backend (auth + baza + storage)
- [ ] Faza 4: Admin panel (upravljanje menijem)
- [ ] Faza 5: Poziv konobara (realtime WebSocket)

## Tech stack

- React 18 + Vite
- React Router v6
- CSS Modules
- Vercel (hosting)
- Supabase (planirano — backend)
