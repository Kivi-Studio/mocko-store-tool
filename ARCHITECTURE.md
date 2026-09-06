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
│   ├── project/{layout,page}.tsx      Editor (Projekt-Id als ?id=…)
│   └── captions/{layout,page}.tsx     Caption-Raster (Ordner-Id als ?folder=…)
│
├── components/     Präsentation (React)
│   ├── captions/   Feature „Alle Texte eines Releases"
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

| Ordner     | Verantwortung                                                                                 | Module                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `model/`   | Domänentypen, Presets und die Validierungs-/Allowlist-Regeln, die das Modell einschränken     | `types`, `presets`, `layout-presets`, `defaults`, `limits`, `color`, `fonts`, `version` |
| `render/`  | aus einem Shot Pixel machen — Canvas zeichnen, Bilder dekodieren, PNG/JPEG exportieren        | `render`, `export`, `image`                                                             |
| `storage/` | Laden/Speichern — IndexedDB-Adapter, Bild-Store, `.studio`-Projektdateien, Upload-Validierung | `idb-storage`, `image-store`, `project-file`, `upload`                                  |
| (root)     | framework-unabhängige Kleinteile                                                              | `utils`                                                                                 |

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

## Sprachen: ein Shot ist eine Position

Weil eine lokalisierte App pro Sprache anders aussieht, unterscheiden sich
**Screenshot und Text**. Ein `Shot` ist deshalb nicht mehr „ein Bild mit
Untertitel", sondern eine **Position** in der Store-Auflistung („das dritte
Bild"), die jede Sprache mit ihrem eigenen Bild und Text füllt:

```
Shot.images:   Record<langCode, imageId | null>
Shot.captions: Record<langCode, { claim, sub }>
Project.languages: Language[]   // erste ist die Standardsprache
```

Die Geräte-Platzierung (`offX`/`offY`/`scale`) bleibt geteilt — sie ist eine
Layout-Entscheidung über die Position, keine Übersetzung.

- **Lesen immer über `model/caption`** (`captionFor`, `imageIdFor`): ein noch
  nicht gefüllter Eintrag fehlt schlicht, statt als Fehler aufzutreten.
- **Der Editor kennt eine aktive Sprache** (`LanguageContext`, reiner UI-State):
  eine Stelle zum Umschalten, Canvas, Karten und Uploads folgen.
- **`addShots` füllt erst Lücken, dann hängt es an.** Den englischen Satz in ein
  Projekt zu werfen, dessen deutscher schon steht, vervollständigt die
  vorhandenen Positionen — statt eine zweite Reihe daneben zu legen.
- **Export** schreibt bei mehreren Sprachen einen ZIP-Ordner je Sprache; der
  Code steht zusätzlich im Dateinamen.

## Bilder liegen außerhalb des States

Screenshots lagen früher als base64-Data-URLs **im** persistierten State. Das
hatte zwei Kosten, die mit jedem aufgehobenen Release wuchsen: Jeder Autosave
klonte und schrieb die gesamte Bibliothek, und jede Version legte ihre eigene
Kopie unveränderter Screenshots ab.

`storage/image-store` speichert Bilder daher **inhaltsadressiert** in einer
eigenen IndexedDB-Datenbank: Schlüssel ist der SHA-256 der Bytes, der Wert sind
die Rohbytes plus Mime-Typ. Ein `Shot` hält nur noch `imageId`.

- **Dedup fällt dabei ab.** Identische Bytes landen auf einem Eintrag — und in
  der Praxis sind die Wiederholungen genau die Shots, die sich zwischen zwei
  Releases nicht geändert haben.
- **Auflösung** läuft über genau eine Stelle, `render/image.loadImageById`;
  Objekt-URLs werden je Content-Id zwischengespeichert.
- **`.studio`-Einträge heißen nach der Content-Id**, ein Bild wird also pro
  Archiv einmal geschrieben. Beim Import kollabieren auch die Mehrfachkopien
  älterer Archive. Screenshots sind bereits komprimiertes PNG/JPEG — Deflate
  bringt nichts, Dedup ist der einzige Hebel auf die Archivgröße.
- **Garbage Collection** nach der Hydration: was der State nicht mehr
  referenziert, fliegt raus. Ein leerer State wird übersprungen — das ist
  wahrscheinlicher ein fehlgeschlagener Ladevorgang als eine leere Bibliothek.

## Statt Migrationen: exportieren und importieren

Es gibt **keine** Persist-Migrationen. Der State liegt unter dem Schlüssel
`mocko`, Version 1; was unter dem alten `screenshot-studio` liegt, bleibt
physisch unangetastet liegen, statt verworfen zu werden.

Der Weg über eine Modelländerung hinweg ist stattdessen **exportieren →
importieren**. Der `.studio`-Reader liest die alten Formen ohnehin — ein Shot
ohne `images`-Map gehört zur einzigen Sprache, ein Projekt ohne `languages`
bekommt die Standardsprache — und liefert das aktuelle Modell. Er _ist_ der
Migrator, und zwar einer, den man beliebig oft gegen eine Datei laufen lassen
und prüfen kann, statt eines Einmalversuchs gegen die lebende Datenbank.

Das ist eine bewusste Entscheidung für eine App mit genau einem Nutzer: rund
500 Zeilen Migrations-Maschinerie für einen Übergang, der einmal stattfindet,
sind teurer als der Import-Schritt, den es ohnehin gibt.

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
