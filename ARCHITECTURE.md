# Architecture

Mocko is a pure browser app (no backend, no sign-in) for creating App Store and
Google Play screenshots. All project data lives locally in IndexedDB.

**Stack:** Next.js (App Router) · React · TypeScript · Zustand (state) ·
Tailwind + shadcn/ui (UI) · Canvas 2D (rendering/export) · Vitest (tests).

## Folder structure

```
src/
├── app/            Routing & framework conventions (Next.js App Router)
│   ├── layout.tsx, page.tsx          Root layout + start page (gallery)
│   ├── error.tsx, global-error.tsx, not-found.tsx
│   ├── manifest.ts, globals.css
│   ├── project/{layout,page}.tsx      Editor (project id as ?id=…)
│   └── captions/{layout,page}.tsx     Caption grid (folder id as ?folder=…)
│
├── components/     Presentation (React)
│   ├── captions/   Feature "all texts of a release"
│   ├── editor/     Feature "editor": canvas, sidebar, topbar, shots …
│   ├── gallery/    Feature "project overview"
│   └── ui/         Reusable primitives (shadcn/ui)
│
├── lib/            Framework-free logic (no React dependency)
│   ├── model/      Domain model & rules
│   ├── render/     Canvas/pixel pipeline
│   ├── storage/    Persistence & file I/O
│   └── utils.ts    Generic helpers (cn, createId, slugify …)
│
└── store/          Global state (Zustand)
    ├── useProjectStore.ts   Projects, shots, settings + persistence
    └── useUndoGroup.ts      Undo grouping
```

Tests are **co-located** next to their module (`foo.ts` → `foo.test.ts`).

## Layers & dependency direction

Dependencies consistently point "inwards". UI and store may depend on `lib/`,
while `lib/` knows neither React, the store nor the components.

```
app/  ─┐
store/ ─┼──►  lib/  ──►  (browser APIs & external packages only)
comp/ ─┘
```

- **`app/`:** only routing/layout and wiring up the components.
- **`components/`:** presentation and interaction; reads data from the store,
  calls logic from `lib/`. `ui/` is purely presentational.
- **`store/`:** single source of truth for runtime state; encapsulates
  persistence via the storage adapter.
- **`lib/`:** pure, testable functions. No access to React/store/UI.

## `lib/` in detail

| Folder     | Responsibility                                                                                              | Modules                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `model/`   | domain types, presets and the validation/allowlist rules that constrain the model                           | `types`, `presets`, `layout-presets`, `defaults`, `limits`, `color`, `fonts`, `version` |
| `render/`  | turn a shot into pixels: draw the canvas, decode images, export PNG/JPEG                                    | `render`, `export`, `image`                                                             |
| `storage/` | load/save: IndexedDB adapter, image store, `.studio` project files, upload validation, the sample workspace | `idb-storage`, `image-store`, `project-file`, `upload`, `demo-workspace`                |
| (root)     | framework-independent odds and ends                                                                         | `utils`                                                                                 |

Dependency direction within `lib/`: `storage/` and `render/` build on `model/`,
`model/` only on `utils`. No cycles between the groups.

**Security-relevant:** `color`, `fonts` and `limits` are deliberately allowlists
or value ranges. They protect both the editor and the import of `.studio` files
from elsewhere against smuggling disallowed values into inline CSS or the canvas
(e.g. `url(...)` injection via a color string).

## Apps & releases

A folder bundles the variants of _one_ release: the same app per store, device
class and language (`iPhone (de)`, `iPad (de)`, `Play (en)` …). Three rules
follow from that:

- **Project names are unique per folder**, not globally. Only then is the copy
  of a folder a real copy rather than a set of `" (2)"` names.
- **`model/version`** splits a folder name into app name and version
  (`"Mocko 1.2.0"`) so that `createFolderVersion` can copy the folder with its
  projects to `<App> X.Y.Z`, optionally with the screenshots cleared while
  captions and layout are kept.
- **`applyToProjects`** transfers design and/or captions from one variant to
  its siblings. Preset and screenshots stay untouched. They are exactly what
  makes a variant a variant.

Above the folders sits a **pure view layer**, not a model construct:
`groupFolders` groups folders with the same key (`appName ?? parsed base`) into
an app, from two members upwards. Folders without a version have their full
name as key and therefore never group by accident; `appName` is the exception
for folders whose name does not follow the convention. The gallery thus knows
three levels, root → app (`?app=`) → release (`?folder=`), without a folder
ever containing a folder.

## Languages: a shot is a position

Because a localized app looks different in every language, **screenshot and
text** differ. A `Shot` is therefore no longer "an image with a caption" but a
**position** in the store listing ("the third image") that every language
fills with its own image and text:

```
Shot.images:   Record<langCode, imageId | null>
Shot.captions: Record<langCode, { claim, sub }>
Project.languages: Language[]   // the first one is the default language
```

Device placement (`offX`/`offY`/`scale`) stays shared. It is a layout decision
about the position, not a translation.

- **Always read via `model/caption`** (`captionFor`, `imageIdFor`): an entry
  that has not been filled yet is simply missing instead of showing up as an
  error.
- **The editor knows one active language** (`LanguageContext`, pure UI state):
  one place to switch, and canvas, cards and uploads follow.
- **`addShots` fills gaps first, then appends.** Dropping the English set into
  a project whose German one is already in place completes the existing
  positions instead of laying out a second row next to them.
- **Export** writes one ZIP folder per language when there are several; the
  code is also part of the file name.

## Images live outside the state

Screenshots used to live as base64 data URLs **inside** the persisted state.
That had two costs, which grew with every release kept around: every autosave
cloned and wrote the entire library, and every version stored its own copy of
unchanged screenshots.

`storage/image-store` therefore stores images **content-addressed** in a
separate IndexedDB database: the key is the SHA-256 of the bytes, the value is
the raw bytes plus MIME type. A `Shot` now only holds an `imageId`.

- **Dedup comes for free.** Identical bytes end up in one entry, and in
  practice the repetitions are exactly the shots that did not change between
  two releases.
- **Resolution** goes through exactly one place, `render/image.loadImageById`;
  object URLs are cached per content id.
- **`.studio` entries are named after the content id**, so an image is written
  once per archive. On import, the duplicate copies in older archives collapse
  as well. Screenshots are already compressed PNG/JPEG. Deflate gains nothing,
  so dedup is the only lever on archive size.
- **Garbage collection** after hydration: whatever the state no longer
  references is thrown out. An empty state is skipped. That is more likely a
  failed load than an empty library.

## Instead of migrations: export and import

There are **no** persist migrations. The state lives under the key `mocko`,
version 1; whatever lies under the old `screenshot-studio` stays physically
untouched instead of being discarded.

The way across a model change is instead **export → import**. The `.studio`
reader reads the old shapes anyway (a shot without an `images` map belongs to
the only language, a project without `languages` gets the default language)
and returns the current model. It _is_ the migrator, and one that can be run
against a file and checked as often as you like, instead of a one-shot attempt
against the live database.

That is a deliberate decision for an app with exactly one user: around 500
lines of migration machinery for a transition that happens once are more
expensive than the import step, which exists anyway.

The flip side: without a current backup, a library is gone after such a
switch. That is why the gallery permanently reminds you of it
(`BackupReminder`) as soon as a project exists, and offers the export right
there. And so that restoring takes no detour, an import into an empty
workspace does not ask the "merge or replace" question at all. Both would
amount to the same thing there (`import-plan.ts`). The file can also be dropped
anywhere on the gallery page (`BackupDropZone`); that runs through the same
import path as the menu.

The counterpart is **Delete everything** in the Backup menu
(`wipeWorkspace`): state, persisted copy, every stored image and the old
`screenshot-studio` key go in one step. It is the only code path that touches
that key, and it is deliberately not undoable: the images are gone, so a
restored state would only point into the void. The empty state is written
before the images are dropped, so another open tab picks it up instead of
saving its stale copy back later.

## The sample workspace is a file, not code

`?demo` and "Load sample workspace" bring in two fictional apps to click
through. The sample is **`public/demo.studio`**, an ordinary workspace export,
and `storage/demo-workspace` does little more than fetch it and hand it to
`readWorkspaceFile`. The only extra step is `withDefaultLanguage`, which moves
the requested language to the front so `?demo=de` shows German covers.

That is deliberate: the reader is the migrator anyway, so the file rides along
with every model change for free, and a test reads the shipped file to make
sure it stays complete and readable. Changing what the demo shows is an
editing job in Mocko followed by "Export everything", not a code change. The
screens inside were drawn once with a throwaway canvas script (kept locally
under `prototypes/`, which is gitignored); they are JPEGs, because the
gradients would cost megabytes as PNG.

## State & persistence

- **Zustand** holds projects, shots and all settings.
- Persistence goes through an **IndexedDB adapter** (`storage/idb-storage.ts`),
  mounted as the Zustand `persist` storage. External writes (another tab) are
  detected and adopted.
- The editor always works against a project from the store; export and file
  format are pure `lib/` functions with no reference to state.

## Conventions

- **Path alias** `@/…` → `src/…` (no `../../../`). Example:
  `@/lib/render/export`, `@/store/useProjectStore`.
- **Feature-first:** new UI belongs in a feature folder under
  `components/<feature>/`; only truly generic primitives go to `ui/`.
- **Logic belongs in `lib/`**, not in components. That keeps it testable
  without a DOM. New logic goes into the matching subfolder
  (`model`/`render`/`storage`).
- **Client vs. server:** interactive components carry `"use client"`; pure
  layout/routing files stay server components.
- **Tests co-located** and run with Vitest (`npm test`).

## Useful commands

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # next typegen && tsc --noEmit
npm run lint       # ESLint
npm test           # Vitest
```
