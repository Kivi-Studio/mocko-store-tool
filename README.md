# Mocko

**Produktion:** [https://mocko.kivistudio.de](https://mocko.kivistudio.de)

Ein Tool zum Erstellen von **App Store & Google Play Store Screenshots** — mit
Device-Frames (iPhone, iPad, Pixel), Hintergründen (Solid/Gradient),
Text-Overlays und PNG-Export. Läuft vollständig im Browser; alle Daten werden
lokal in IndexedDB gespeichert (kein Backend, keine Anmeldung).

## Funktionsumfang

- **Projekte & Ordner:** Ein Projekt ist ein Screenshot-Set für _ein_
  Store-Format (z. B. App Store · iPhone 6.9″). Ordner bündeln die Varianten
  eines Releases — Store × Geräteklasse × Sprache.
- **Mehrsprachig:** Ein Projekt hält beliebig viele Sprachen — jede mit
  eigenen Screenshots _und_ eigenen Texten, weil eine lokalisierte App pro
  Sprache anders aussieht. Ein Umschalter im Editor, der Export schreibt einen
  Ordner je Sprache.
- **Editor:** Screenshots hochladen, Claim und Subtext je Position, Hintergrund
  (Solid/Gradient/Bild), Device-Frame, Layout-Presets; Position und Größe des
  Geräts je Shot.
- **Releases versionieren:** Ordner duplizieren oder per **„Neue Version…"**
  unter `<App> X.Y.Z` kopieren — auf Wunsch mit geleerten Screenshots, wobei
  Anzahl, Captions und Layout erhalten bleiben.
- **Nach Sprache zusammenführen:** bestehende „App (iOS) (DE)"/„App (iOS) (EN)"-
  Paare lassen sich mit Vorschau zu einem mehrsprachigen Projekt falten.
- **Caption-Ansicht je Release:** alle Texte eines Ordners als Raster —
  Zeilen sind Shot-Positionen, Spalten die Projekte —, direkt editierbar,
  statt sich durch jedes Projekt einzeln zu klicken.
- **Auf Geschwister übertragen:** Design und/oder Captions von einer fertigen
  Variante auf die anderen Projekte im Ordner anwenden, ohne Preset und
  Screenshots anzufassen.
- **Import/Export:** Screenshots gebündelt als PNG/JPEG-`.zip`; einzelne
  Projekte, ein Ordner, eine Auswahl oder der ganze Workspace als
  `.studio`-Datei.
- **Undo/Redo**, automatische Persistenz (IndexedDB) und PWA-Support
  (installierbar, offline-fähig).
- **Screenshots liegen inhaltsadressiert** in einem eigenen Store: ein Bild,
  das mehrere Releases benutzen, wird einmal gespeichert und einmal exportiert.

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

## Build & Deployment

Die App ist vollständig clientseitig und wird als **statischer Export**
(`output: "export"`) gebaut — es gibt keinen Node-Server im Betrieb.

```bash
# Produktions-Build erzeugen → schreibt nach out/
npm run build
```

Das Ergebnis liegt anschließend im Ordner `out/` (statisches HTML/JS/CSS) und
kann von jedem beliebigen Static-Host ausgeliefert werden — z. B. netcup Shared
Hosting per FTP. Die Sicherheits-Header werden dabei über
[`public/.htaccess`](public/.htaccess) (Apache) gesetzt, das beim Build nach
`out/` kopiert wird.

Zum lokalen Prüfen des Builds genügt ein beliebiger Static-Server, z. B.:

```bash
npx serve out
```

## npm-Scripts

| Script                 | Beschreibung                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Startet den Next.js-Entwicklungsserver (Port 3000)      |
| `npm run build`        | Erstellt den statischen Produktions-Build nach `out/`   |
| `npm run start`        | (bei `output: "export"` nicht genutzt — siehe Build)    |
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
- **Canvas 2D** für das Rendering, **[JSZip](https://stuk.github.io/jszip/)** + **file-saver** für den Export
- **[Vitest](https://vitest.dev)** + Testing Library + `jsdom` + `fake-indexeddb` für Tests

## Projektstruktur

```
src/
  app/                 # Next.js App Router
    page.tsx           # /         – Galerie (Ordner & Projekte)
    project/           # /project  – Editor, Projekt-Id als ?id=…
    captions/          # /captions – Texte eines Releases, Ordner-Id als ?folder=…
    manifest.ts        # PWA-Manifest
  components/
    captions/          # Caption-Raster über ein ganzes Release
    editor/            # Canvas, Sidebar, Topbar, Shot-Karten
    gallery/           # Ordner- & Projektkarten, Dialoge, Mehrfachauswahl
    ui/                # wiederverwendbare UI-Primitives
  lib/
    model/             # Domänentypen, Presets, Limits, Versionen, Locales
    render/            # Canvas-Rendering & Export
    storage/           # IndexedDB, Bild-Store, .studio-Dateien, Upload
  store/               # Zustand-Store (Projekte, Ordner, Undo/Redo)
```

Mehr zu Schichten und Abhängigkeitsrichtung in
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Hinweis für die Weiterentwicklung

Dieses Projekt nutzt eine Next.js-Version mit ggf. abweichenden APIs und
Konventionen. Siehe [`AGENTS.md`](AGENTS.md) — die relevanten Guides liegen unter
`node_modules/next/dist/docs/` und sollten vor Änderungen konsultiert werden.
