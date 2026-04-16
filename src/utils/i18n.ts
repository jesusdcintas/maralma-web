import esTranslation from "../../public/locales/es/translation.json";
import enTranslation from "../../public/locales/en/translation.json";

export type Lang = "es" | "en";

const translations: Record<Lang, Record<string, unknown>> = {
  es: esTranslation as Record<string, unknown>,
  en: enTranslation as Record<string, unknown>,
};

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

export function t(key: string, lang: Lang = "es"): string {
  return getNestedValue(translations[lang], key);
}
