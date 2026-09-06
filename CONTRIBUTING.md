# Contributing to Mocko

Thanks for taking a look. Mocko is built and maintained for Kivi Studio's own
release work, so there is no roadmap to sign up for — but bug reports, small
fixes and well-scoped features are welcome.

## Before you write code

**This is not the Next.js you may know.** The project runs a Next.js version
whose APIs, conventions and file structure differ from most tutorials and from
what language models were trained on. The authoritative guides ship with the
dependency itself:

```
node_modules/next/dist/docs/
```

Read the relevant guide before changing anything under `src/app/`, and take
deprecation notices seriously. See [`AGENTS.md`](AGENTS.md).

Then read [`ARCHITECTURE.md`](ARCHITECTURE.md). It explains the layering, why
images live outside the state, and why there are no store migrations. A change
that fights those decisions will be hard to merge.

## Setup

Node `22` (see [`.nvmrc`](.nvmrc); minimum `>=20.9`). No environment variables,
no database, no API keys — the app is fully client-side.

```bash
nvm use          # or install Node 22 yourself
npm ci
npm run dev      # http://localhost:3000
```

## Before every commit

```bash
npm run check
```

That runs ESLint, `tsc --noEmit`, the Prettier check and the Vitest suite. CI
runs the same command, and a red check never deploys. If only formatting is off,
`npm run format` fixes it.

## Conventions

- **Path alias** `@/…` → `src/…`. No `../../../`.
- **Feature-first:** new UI goes into `components/<feature>/`; only genuinely
  generic primitives belong in `components/ui/`.
- **Logic belongs in `lib/`**, not in components, so it stays testable without a
  DOM. Pick the matching subfolder: `model`, `render` or `storage`.
- **Tests are co-located** next to the code they cover, as `*.test.ts(x)`.
- **Client vs. server:** interactive components carry `"use client"`; pure
  layout and routing files stay server components.
- **Commit messages** are written in the imperative, describing the effect
  rather than the diff — e.g. "Show the build number next to the version".

## Pull requests

- Keep one PR to one concern. Small and reviewable beats complete.
- Say what changed and why. Screenshots help for anything visual.
- Add or update tests when you touch logic in `lib/` or the store.
- Run `npm run check` before pushing.

For larger features, please open an issue first so we can agree on the shape
before you spend time on it.

## Data safety

Everything users create lives in their browser's IndexedDB — there is no
backend and no copy anywhere else. Changes to the store, the image store or the
`.studio` file format can destroy real work. Treat them with care, cover them
with tests, and prefer export/import over silent migrations.

## Licensing

Mocko is licensed under the
[GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html).
By contributing, you agree that your contribution is licensed under the same
terms.
