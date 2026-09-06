import type { Language } from "@/lib/model/types";

/**
 * A curated list of common App Store / Play Store locales. Users pick from
 * here or add a custom code + label. Codes are used verbatim as ZIP folder and
 * file-name segments, so they stay short and filename-safe.
 */
export const LOCALES: readonly Language[] = [
  { code: "en", label: "English" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "es-419", label: "Spanish (Latin America)" },
  { code: "it", label: "Italian" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh-Hans", label: "Chinese (Simplified)" },
  { code: "zh-Hant", label: "Chinese (Traditional)" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
] as const;

export const DEFAULT_LANGUAGE: Language = { code: "en", label: "English" };

/** Filename-safe locale code: letters, digits and dashes, 2–35 chars. */
const LANG_CODE_RE = /^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/;

/** True when `code` is a syntactically valid, filename-safe locale code. */
export function isValidLangCode(code: unknown): code is string {
  return (
    typeof code === "string" &&
    code.length >= 2 &&
    code.length <= 35 &&
    LANG_CODE_RE.test(code)
  );
}

/** Looks up the label for a known locale, defaulting to the code itself. */
export function labelForCode(code: string): string {
  return LOCALES.find((l) => l.code === code)?.label ?? code;
}

/**
 * Guesses the language a project is for from its name — "Telly (iOS) (DE)"
 * yields "de".
 *
 * Only codes from {@link LOCALES} are recognised, and only inside parentheses
 * or brackets, which is how the suffix is conventionally written. That keeps an
 * unrelated "(iOS)" from being read as a language. The last match wins, since
 * the locale is normally the final qualifier.
 *
 * Used when splitting old one-project-per-language setups: a guess only labels
 * a project, it never moves content, so getting it wrong is fixed by renaming
 * the language rather than by losing anything.
 */
export function guessLangCode(name: string): string | null {
  let found: string | null = null;
  for (const match of name.matchAll(/[([]([^)\]]+)[)\]]/g)) {
    const token = match[1].trim().toLowerCase();
    const locale = LOCALES.find((l) => l.code.toLowerCase() === token);
    if (locale) found = locale.code;
  }
  return found;
}
