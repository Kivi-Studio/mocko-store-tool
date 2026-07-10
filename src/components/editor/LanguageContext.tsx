"use client";

import { createContext, useContext } from "react";

/** The language currently shown/edited in the editor (UI-only, not persisted). */
export type LanguageContextValue = {
  language: string;
  setLanguage: (code: string) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider = LanguageContext.Provider;

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
