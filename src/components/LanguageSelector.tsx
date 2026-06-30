import { useI18n, type LanguageMode } from "../i18n";

const OPTIONS: LanguageMode[] = ["system", "en", "zh-CN"];

export function LanguageSelector() {
  const { language, languageMode, setLanguageMode, t } = useI18n();

  return (
    <label className="language-selector">
      <span>{t("language.label")}</span>
      <select
        aria-label={t("language.current")}
        value={languageMode}
        onChange={(event) => setLanguageMode(event.currentTarget.value as LanguageMode)}
      >
        {OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === "system"
              ? t("language.system")
              : option === "zh-CN"
                ? t("language.chinese")
                : t("language.english")}
          </option>
        ))}
      </select>
      <small>{language === "zh-CN" ? "中文" : "English"}</small>
    </label>
  );
}
