# Architektur

Mocko ist eine reine Browser-App (kein Backend, keine Anmeldung) zum Erstellen
von App-Store- und Google-Play-Screenshots. Alle Projektdaten liegen lokal in
IndexedDB.

**Stack:** Next.js (App Router) · React · TypeScript · Zustand (State) ·
Tailwind + shadcn/ui (UI) · Canvas 2D (Rendering/Export) · Vitest (Tests).

## Ordnerstruktur

```
src/
├── app/            Routing & Framework-Konventionen (Next.js App Router)
│   ├── layout.tsx, page.tsx          Root-Layout + Startseite (Galerie)
│   ├── error.tsx, global-error.tsx, not-found.tsx
│   ├── manifest.ts, globals.css
│   └── project/{layout,page}.tsx      Editor (Projekt-Id als ?id=…)
│
├── components/     Präsentation (React)
│   ├── editor/     Feature „Editor": Canvas, Sidebar, Topbar, Shots …
│   ├── gallery/    Feature „Projektübersicht"
│   └── ui/         wiederverwendbare Primitives (shadcn/ui)
│
├── lib/            Framework-freie Logik (keine React-Abhängigkeit)
│   ├── model/      Domänenmodell & Regeln
│   ├── render/     Canvas-/Pixel-Pipeline
│   ├── storage/    Persistenz & Datei-IO
│   └── utils.ts    generische Helfer (cn, createId, slugify …)
│
└── store/          globaler State (Zustand)
    ├── useProjectStore.ts   Projekte, Shots, Settings + Persistenz
    └── useUndoGroup.ts      Undo-Gruppierung
```

Tests liegen **co-located** neben ihrem Modul (`foo.ts` → `foo.test.ts`).

## Schichten & Abhängigkeitsrichtung

Die Abhängigkeiten zeigen konsequent nach „innen" — UI und Store dürfen von
`lib/` abhängen, `lib/` kennt weder React, den Store noch die Komponenten.

```
app/  ─┐
store/ ─┼──►  lib/  ──►  (nur Browser-APIs & externe Pakete)
comp/ ─┘
```

- **`app/`** — nur Routing/Layout und das Verdrahten der Komponenten.
- **`components/`** — Darstellung und Interaktion; holt Daten aus dem Store,
  ruft Logik aus `lib/` auf. `ui/` ist rein präsentational.
- **`store/`** — einzige Quelle der Wahrheit für Laufzeit-State; kapselt die
  Persistenz über den Storage-Adapter.
- **`lib/`** — reine, testbare Funktionen. Kein Zugriff auf React/Store/UI.

## `lib/` im Detail

| Ordner     | Verantwortung                                                                             | Module                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `model/`   | Domänentypen, Presets und die Validierungs-/Allowlist-Regeln, die das Modell einschränken | `types`, `presets`, `layout-presets`, `defaults`, `limits`, `color`, `fonts`, `version` |
| `render/`  | aus einem Shot Pixel machen — Canvas zeichnen, Bilder dekodieren, PNG/JPEG exportieren    | `render`, `export`, `image`                                                             |
| `storage/` | Laden/Speichern — IndexedDB-Adapter, `.studio`-Projektdateien, Upload-Validierung         | `idb-storage`, `project-file`, `upload`                                                 |
| (root)     | framework-unabhängige Kleinteile                                                          | `utils`                                                                                 |

Abhängigkeitsrichtung innerhalb `lib/`: `storage/` und `render/` bauen auf
`model/` auf, `model/` nur auf `utils`. Keine Zyklen zwischen den Gruppen.

**Sicherheitsrelevant:** `color`, `fonts` und `limits` sind bewusst Allowlists
bzw. Wertebereiche. Sie schützen sowohl den Editor als auch den Import fremder
`.studio`-Dateien davor, unerlaubte Werte in inline-CSS oder den Canvas zu
schleusen (z. B. `url(...)`-Injection über einen Farbstring).

## Apps & Releases

Ein Ordner bündelt die Varianten _eines_ Releases — dieselbe App je Store,
Geräteklasse und Sprache (`iPhone (de)`, `iPad (de)`, `Play (en)` …). Daraus
folgen drei Regeln:

- **Projektnamen sind pro Ordner eindeutig**, nicht global. Nur so ist die
  Kopie eines Ordners eine echte Kopie und kein Satz `" (2)"`-Namen.
- **`model/version`** zerlegt einen Ordnernamen in App-Name und Version
  (`"Mocko 1.2.0"`), damit `createFolderVersion` den Ordner samt Projekten
  unter `<App> X.Y.Z` kopieren kann — optional mit geleerten Screenshots,
  Captions und Layout bleiben erhalten.
- **`applyToProjects`** überträgt Design und/oder Captions von einer Variante
  auf ihre Geschwister. Preset und Screenshots bleiben unangetastet — genau
  sie machen eine Variante zur Variante.

Über den Ordnern liegt eine **reine Ansichtsebene**, kein Modellkonstrukt:
`groupFolders` fasst Ordner mit gleichem Schlüssel (`appName ?? geparste Basis`)
zu einer App zusammen, ab zwei Mitgliedern. Ordner ohne Version haben ihren
vollen Namen als Schlüssel und gruppieren daher nie versehentlich; `appName`
ist die Ausnahme für Ordner, deren Name die Konvention nicht trägt. Die Galerie
kennt damit drei Ebenen — Wurzel → App (`?app=`) → Release (`?folder=`) —
ohne dass ein Ordner je einen Ordner enthält.

## State & Persistenz

- **Zustand** hält Projekte, Shots und alle Settings.
- Persistiert wird über einen **IndexedDB-Adapter** (`storage/idb-storage.ts`),
  eingehängt als Zustand-`persist`-Storage. Externe Writes (anderer Tab) werden
  erkannt und übernommen.
- Der Editor arbeitet immer gegen ein Projekt aus dem Store; Export und
  Dateiformat sind reine `lib/`-Funktionen ohne State-Bezug.

## Konventionen

- **Pfad-Alias** `@/…` → `src/…` (kein `../../../`). Beispiel:
  `@/lib/render/export`, `@/store/useProjectStore`.
- **Feature-first:** neue UI gehört in einen Feature-Ordner unter
  `components/<feature>/`; nur wirklich generische Primitives nach `ui/`.
- **Logik gehört in `lib/`**, nicht in Komponenten — so bleibt sie ohne DOM
  testbar. Neue Logik in den passenden Unterordner (`model`/`render`/`storage`).
- **Client vs. Server:** interaktive Komponenten tragen `"use client"`; reine
  Layout-/Routing-Dateien bleiben Server-Komponenten.
- **Tests co-located** und mit Vitest ausgeführt (`npm test`).

## Nützliche Befehle

```bash
npm run dev        # Dev-Server
npm run build      # Produktions-Build
npm run typecheck  # next typegen && tsc --noEmit
npm run lint       # ESLint
npm test           # Vitest
```
