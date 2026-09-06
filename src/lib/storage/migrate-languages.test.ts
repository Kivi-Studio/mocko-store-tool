import { describe, it, expect } from "vitest";
import {
  languageForProject,
  migrateProjectToLanguages,
} from "@/lib/storage/migrate-languages";
import { captionFor, imageIdFor } from "@/lib/model/caption";
import { DEFAULT_LANGUAGE } from "@/lib/model/locales";

/** A v6 project: content ids, one screenshot and caption per shot. */
const v6 = (name: string, shots: unknown[] = []) => ({
  id: "p1",
  name,
  createdAt: 1,
  updatedAt: 2,
  presetId: "ios-6-9",
  background: { type: "solid", color: "#000000" },
  text: {},
  device: {},
  folderId: null,
  shots,
});

const shot = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  imageId: "img-1",
  claim: "Alle Serien",
  sub: "an einem Ort",
  offX: 0.1,
  offY: 0,
  scale: null,
  ...over,
});

describe("languageForProject", () => {
  it("takes the locale a name advertises", () => {
    expect(languageForProject("Telly (iOS) (DE)")).toEqual({
      code: "de",
      label: "German",
    });
  });

  it("ignores a bracketed qualifier that is not a locale", () => {
    expect(languageForProject("Telly (iOS)")).toEqual(DEFAULT_LANGUAGE);
  });

  it("takes the last locale when a name carries several", () => {
    expect(languageForProject("App (de) (fr)").code).toBe("fr");
  });

  it("falls back to the default for a plain name", () => {
    expect(languageForProject("Marketing")).toEqual(DEFAULT_LANGUAGE);
  });
});

describe("migrateProjectToLanguages", () => {
  it("files a project's content under the language its name names", () => {
    const project = migrateProjectToLanguages(v6("Telly (iOS) (DE)", [shot()]));

    expect(project.languages).toEqual([{ code: "de", label: "German" }]);
    expect(imageIdFor(project.shots[0], "de")).toBe("img-1");
    expect(captionFor(project.shots[0], "de")).toEqual({
      claim: "Alle Serien",
      sub: "an einem Ort",
    });
  });

  it("keeps the shot's layout and identity", () => {
    const project = migrateProjectToLanguages(v6("X", [shot({ offX: 0.3 })]));
    expect(project.shots[0]).toMatchObject({ id: "s1", offX: 0.3 });
  });

  it("leaves an untouched caption absent rather than storing it blank", () => {
    const project = migrateProjectToLanguages(
      v6("X", [shot({ claim: "", sub: "" })]),
    );
    // "not translated yet" must stay distinguishable from "deliberately blank".
    expect(project.shots[0].captions).toEqual({});
  });

  it("keeps an empty position empty", () => {
    const project = migrateProjectToLanguages(
      v6("X", [shot({ imageId: null, claim: "", sub: "" })]),
    );
    expect(imageIdFor(project.shots[0], DEFAULT_LANGUAGE.code)).toBeNull();
  });

  it("handles a project with no shots", () => {
    const project = migrateProjectToLanguages(v6("Marketing"));
    expect(project.shots).toEqual([]);
    expect(project.languages).toEqual([DEFAULT_LANGUAGE]);
  });

  it("moves no content between projects — each keeps its own", () => {
    const de = migrateProjectToLanguages(
      v6("Telly (DE)", [shot({ imageId: "de-img", claim: "Alle Serien" })]),
    );
    const en = migrateProjectToLanguages(
      v6("Telly (EN)", [shot({ imageId: "en-img", claim: "All your shows" })]),
    );

    expect(imageIdFor(de.shots[0], "de")).toBe("de-img");
    expect(imageIdFor(en.shots[0], "en")).toBe("en-img");
    // The German project knows nothing of English and vice versa: combining
    // them is a separate, explicit step.
    expect(imageIdFor(de.shots[0], "en")).toBeNull();
    expect(imageIdFor(en.shots[0], "de")).toBeNull();
  });
});
