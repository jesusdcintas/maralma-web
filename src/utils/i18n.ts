import esTranslation from "../../public/locales/es/translation.json";

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

export function t(key: string): string {
  return getNestedValue(esTranslation as Record<string, unknown>, key);
}

export const currentLang = "es";
