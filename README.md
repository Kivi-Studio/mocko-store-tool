# Mocko

**Production:** [https://mocko.kivistudio.de](https://mocko.kivistudio.de)

A tool for creating **App Store & Google Play Store screenshots**, with device
frames (iPhone, iPad, Pixel), backgrounds (solid/gradient), text overlays and
PNG export. Runs entirely in the browser; all data is stored locally in
IndexedDB (no backend, no sign-in).

## Features

- **Projects & folders:** A project is a screenshot set for _one_ store format
  (e.g. App Store · iPhone 6.9″). Folders bundle the variants of a release:
  store × device class × language.
- **Multilingual:** A project holds any number of languages, each with its own
  screenshots _and_ its own texts, because a localized app looks different in
  every language. One switch in the editor, and the export writes one folder
  per language.
- **Editor:** upload screenshots, claim and subtext per position, background
  (solid/gradient/image), device frame, layout presets; device position and
  size per shot.
- **Versioning releases:** duplicate a folder, or copy it to `<App> X.Y.Z` via
  **"New version…"**, optionally with the screenshots cleared while count,
  captions and layout are kept.
- **Merge by language:** existing single-language projects can be folded into
  one multilingual project. You tick them off and say which language each one
  is; nothing is guessed.
- **Caption view per release:** all texts of a folder as a grid (rows are shot
  positions, columns are the projects), directly editable, instead of clicking
  through every project one by one.
- **Apply to siblings:** apply design and/or captions from one finished variant
  to the other projects in the folder without touching preset or screenshots.
- **Import/export:** screenshots bundled as a PNG/JPEG `.zip`; individual
  projects, a folder, a selection or the whole workspace as a `.studio` file,
  which can also be dropped straight onto the gallery to import it. The Backup
  menu can also delete everything Mocko has stored in the browser.
- **Undo/redo**, automatic persistence (IndexedDB) and PWA support
  (installable, works offline).
- **Screenshots are content-addressed** in a store of their own: an image used
  by several releases is stored once and exported once.

## Requirements

| Tool        | Version                                         |
| ----------- | ----------------------------------------------- |
| **Node.js** | `22` (see [`.nvmrc`](.nvmrc)); minimum `>=20.9` |
| **npm**     | ships with Node (lockfile: `package-lock.json`) |
| **Browser** | a current browser with IndexedDB support        |

**No** environment variables, database or API keys are needed. The app is
entirely client-side.

If you use [nvm](https://github.com/nvm-sh/nvm), it picks up the Node version
from `.nvmrc`:

```bash
nvm install   # installs the version pinned in .nvmrc
nvm use
```

## Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd kivi-studio-store-tool

# 2. Install dependencies (deterministic, from the lockfile)
npm ci          # or: npm install

# 3. Start the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Build & Deployment

The app is entirely client-side and is built as a **static export**
(`output: "export"`). There is no Node server in production.

```bash
# Create the production build → writes to out/
npm run build
```

The result then sits in the `out/` folder (static HTML/JS/CSS) and can be
served by any static host, e.g. netcup shared hosting via FTP. The security
headers are set via [`public/.htaccess`](public/.htaccess) (Apache), which is
copied into `out/` on build.

To check the build locally, any static server will do, e.g.:

```bash
npx serve out
```

## npm scripts

| Script                 | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Starts the Next.js development server (port 3000)           |
| `npm run build`        | Creates the static production build in `out/`               |
| `npm run start`        | (not used with `output: "export"`, see Build)               |
| `npm run lint`         | ESLint                                                      |
| `npm run typecheck`    | `next typegen` + TypeScript type check (`tsc --noEmit`)     |
| `npm run format`       | Prettier: formats all files                                 |
| `npm run format:check` | Prettier: checks formatting without making changes          |
| `npm test`             | Runs the test suite (Vitest, single run)                    |
| `npm run test:watch`   | Vitest in watch mode                                        |
| `npm run check`        | Everything at once: lint + typecheck + format check + tests |

Running `npm run check` before a commit is recommended.

## Tech stack

- **[Next.js](https://nextjs.org) 16** (App Router) + **React 19** + **TypeScript**
- **[Tailwind CSS v4](https://tailwindcss.com)** with shadcn/[Base UI](https://base-ui.com) components
- **[Zustand](https://zustand.docs.pmnd.rs) 5** for state, **[zundo](https://github.com/charkour/zundo)** for undo/redo
- **[idb-keyval](https://github.com/jakearchibald/idb-keyval)** for IndexedDB persistence
- **Canvas 2D** for rendering, **[JSZip](https://stuk.github.io/jszip/)** + **file-saver** for export
- **[Vitest](https://vitest.dev)** + Testing Library + `jsdom` + `fake-indexeddb` for tests

## Project structure

```
src/
  app/                 # Next.js App Router
    page.tsx           # /         : Gallery (folders & projects)
    project/           # /project  : Editor, project id as ?id=…
    captions/          # /captions : Texts of a release, folder id as ?folder=…
    manifest.ts        # PWA manifest
  components/
    captions/          # Caption grid across a whole release
    editor/            # Canvas, sidebar, topbar, shot cards
    gallery/           # Folder & project cards, dialogs, multi-select
    ui/                # Reusable UI primitives
  lib/
    model/             # Domain types, presets, limits, versions, locales
    render/            # Canvas rendering & export
    storage/           # IndexedDB, image store, .studio files, upload
  store/               # Zustand store (projects, folders, undo/redo)
```

More on layers and dependency direction in
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Note for further development

This project uses a Next.js version whose APIs and conventions may differ from
what you know. See [`AGENTS.md`](AGENTS.md). The relevant guides are in
`node_modules/next/dist/docs/` and should be consulted before making changes.

## License

Copyright (c) 2026 Pierre Sucker (Kivi Studio)

Mocko is free software, licensed under the
[GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html)
(see [`LICENSE`](LICENSE)). In short:

- **Allowed:** read, modify and fork the code, self-host it, and use it
  professionally, including for screenshots of commercial apps.
- **Required:** if you distribute a modified version, or offer one to others
  over a network (e.g. host your own fork publicly), you must make its complete
  source code available under the same license.

The network clause is the reason for choosing the AGPL over a permissive
license: Mocko is meant to stay free, and any fork offered as a service has to
stay open as well.
