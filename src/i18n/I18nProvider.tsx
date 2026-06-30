import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dictionaries, type TranslationKey } from "./translations";

export type Language = keyof typeof dictionaries;
export type LanguageMode = Language | "system";

type I18nContextValue = {
  language: Language;
  languageMode: LanguageMode;
  setLanguageMode: (mode: LanguageMode) => void;
  t: (key: TranslationKey) => string;
};

const STORAGE_KEY = "synapse.language";

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveSystemLanguage(): Language {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

function normalizeLanguageMode(value: string | null): LanguageMode {
  if (value === "en" || value === "zh-CN" || value === "system") {
    return value;
  }
  return "system";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [languageMode, setLanguageModeState] = useState<LanguageMode>(() => {
    if (typeof window === "undefined") {
      return "system";
    }
    return normalizeLanguageMode(window.localStorage.getItem(STORAGE_KEY));
  });
  const [systemLanguage, setSystemLanguage] = useState<Language>(resolveSystemLanguage);

  useEffect(() => {
    const onLanguageChange = () => setSystemLanguage(resolveSystemLanguage());
    window.addEventListener("languagechange", onLanguageChange);
    return () => window.removeEventListener("languagechange", onLanguageChange);
  }, []);

  const language = languageMode === "system" ? systemLanguage : languageMode;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, languageMode);
    document.documentElement.lang = language;
  }, [language, languageMode]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      languageMode,
      setLanguageMode: setLanguageModeState,
      t: (key) => dictionaries[language][key],
    }),
    [language, languageMode],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
