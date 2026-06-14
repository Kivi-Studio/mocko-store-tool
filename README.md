# Screenshot Creator

Ein Tool zum Erstellen von **App Store & Google Play Store Screenshots** — mit
Device-Frames (iPhone, iPad, Pixel), Hintergründen (Solid/Gradient),
Text-Overlays und PNG-Export. Läuft vollständig im Browser; alle Daten werden
lokal in IndexedDB gespeichert (kein Backend, keine Anmeldung).

## Funktionsumfang

- **Drei-Ebenen-Struktur:** Projekt (eine App) → Design (eine Sammlung wie
  „App Store" oder „Play Store") → Storebild (ein einzelnes, exportierbares PNG).
- **Editor** pro Storebild: Device-Frames platzieren/skalieren/rotieren,
  Hintergrund, Text-Overlays, Format & Export-Größe.
- **Duplizieren** von Storebildern und ganzen Designs (z. B. App-Store-Set
  klonen und auf Android-Formate umstellen).
- **Import/Export:** einzelne Designs als `.design`-Datei sichern/teilen,
  Storebilder gebündelt als PNG-`.zip` exportieren.
- **Undo/Redo**, automatische Persistenz (IndexedDB) und PWA-Support
  (installierbar, offline-fähig).

## Voraussetzungen

| Werkzeug    | Version                                                    |
| ----------- | ---------------------------------------------------------- |
| **Node.js** | `22` (siehe [`.nvmrc`](.nvmrc)); Minimum `>=20.9`          |
| **npm**     | wird mit Node ausgeliefert (Lockfile: `package-lock.json`) |
| **Browser** | aktueller Browser mit IndexedDB-Support                    |

Es werden **keine** Umgebungsvariablen, Datenbank oder API-Keys benötigt — die
App ist vollständig clientseitig.

Wenn du [nvm](https://github.com/nvm-sh/nvm) nutzt, übernimmt es die Node-Version
aus `.nvmrc`:

```bash
nvm install   # installiert die in .nvmrc gepinnte Version
nvm use
```

## Setup

```bash
# 1. Repository klonen
git clone <repo-url>
cd kivi-studio-store-tool

# 2. Abhängigkeiten installieren (deterministisch, gemäß Lockfile)
npm ci          # oder: npm install

# 3. Dev-Server starten
npm run dev
```

Anschließend [http://localhost:3000](http://localhost:3000) im Browser öffnen.

## npm-Scripts

| Script                 | Beschreibung                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Startet den Next.js-Entwicklungsserver (Port 3000)      |
| `npm run build`        | Erstellt den Produktions-Build                          |
| `npm run start`        | Startet den Produktions-Server (nach `build`)           |
| `npm run lint`         | ESLint                                                  |
| `npm run typecheck`    | `next typegen` + TypeScript-Typprüfung (`tsc --noEmit`) |
| `npm run format`       | Prettier — formatiert alle Dateien                      |
| `npm run format:check` | Prettier — prüft Formatierung ohne Änderungen           |
| `npm test`             | Führt die Test-Suite aus (Vitest, einmalig)             |
| `npm run test:watch`   | Vitest im Watch-Modus                                   |
| `npm run check`        | Alles zusammen: Lint + Typecheck + Format-Check + Tests |

Vor einem Commit empfiehlt sich `npm run check`.

## Tech-Stack

- **[Next.js](https://nextjs.org) 16** (App Router) + **React 19** + **TypeScript**
- **[Tailwind CSS v4](https://tailwindcss.com)** mit shadcn-/[Base UI](https://base-ui.com)-Komponenten
- **[Zustand](https://zustand.docs.pmnd.rs) 5** für State, **[zundo](https://github.com/charkour/zundo)** für Undo/Redo
- **[idb-keyval](https://github.com/jakearchibald/idb-keyval)** für IndexedDB-Persistenz
- **[html-to-image](https://github.com/bubkoo/html-to-image)** + **[JSZip](https://stuk.github.io/jszip/)** + **file-saver** für den Export
- **[Vitest](https://vitest.dev)** + Testing Library + `jsdom` + `fake-indexeddb` für Tests

## Projektstruktur

```
src/
  app/                 # Next.js App Router
    page.tsx           # /              – Projektübersicht
    project/[id]/      # /project/[id]  – Designs eines Projekts
    design/[id]/       # /design/[id]   – Storebilder eines Designs
    editor/[id]/       # /editor/[id]   – Editor für ein einzelnes Storebild
    manifest.ts        # PWA-Manifest
  components/
    editor/            # Canvas, Frames, Text-Layer, Toolbar
    gallery/           # Projekt-/Design-/Storebild-Karten & Galerien
    panels/            # Editor-Seitenpanels (Format, Background, Frames, Text, Export)
    ui/                # wiederverwendbare UI-Primitives
  lib/                 # Domain-Typen, Geräte/Export-Größen, Export, IndexedDB, Utils
  store/               # Zustand-Store (Projekte/Designs/Storebilder, Undo/Redo)
```

## Hinweis für die Weiterentwicklung

Dieses Projekt nutzt eine Next.js-Version mit ggf. abweichenden APIs und
Konventionen. Siehe [`AGENTS.md`](AGENTS.md) — die relevanten Guides liegen unter
`node_modules/next/dist/docs/` und sollten vor Änderungen konsultiert werden.
</content>
</invoke>
