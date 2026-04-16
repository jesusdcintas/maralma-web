import { supabaseAdmin } from "../lib/supabase-admin";
import { t, type Lang } from "./i18n";

export interface CmsOverrides {
  text: Record<string, string>;
  images: Record<string, string>;
}

/** Fetch all CMS overrides from Supabase (text + images). */
export async function loadCms(): Promise<CmsOverrides> {
  const { data } = await supabaseAdmin
    .from("gallery")
    .select("alt_text, url, categoria")
    .in("categoria", ["cms", "cms_img"]);

  const text: Record<string, string> = {};
  const images: Record<string, string> = {};

  for (const row of data || []) {
    if (row.categoria === "cms") {
      text[row.alt_text] = row.url;
    } else if (row.categoria === "cms_img") {
      images[row.alt_text] = row.url;
    }
  }

  return { text, images };
}

/** Return CMS text override or fall back to i18n translation. */
export function c(cms: CmsOverrides, key: string, lang: Lang = "es"): string {
  return cms.text[key] ?? t(key, lang);
}

/** Return inline background-image style if CMS image override exists. */
export function imgStyle(cms: CmsOverrides, key: string): string | undefined {
  const url = cms.images[key];
  return url
    ? `background-image:url(${url});background-size:cover;background-position:center`
    : undefined;
}
