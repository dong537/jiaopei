/** 公开站点只能读取经清洗的官方名单投影，绝不触及工商导出或匹配表。 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { assertPublicationSiteUrl } from "../site-url.mjs";

export type PublicSourceKind = "official_whitelist" | "after_school_reference" | "annual_check" | "single_license_notice";

export type PublicGdRecord = {
  id: string;
  name: string;
  licenseNo: string;
  city: string;
  citySlug: string;
  county: string | null;
  address: string | null;
  trainingType: string | null;
  projects: string | null;
  sourceKey: string;
  sourceUrl: string;
  publisher: string;
  title: string;
  asOf: string | null;
  publishedAt: string | null;
  collectedAt: string | null;
  annualRating: string | null;
  sourceKind: PublicSourceKind;
};

export type PublicGdSource = {
  key: string;
  publisher: string;
  title: string;
  url: string;
  asOf: string | null;
  publishedAt: string | null;
  citySlug: string;
  city: string;
  county: string | null;
  recordCount: number;
  sourceKind: PublicSourceKind;
};

export type PublicGdProjection = {
  generatedAt: string;
  preview: boolean;
  records: PublicGdRecord[];
  sources: PublicGdSource[];
  stats: {
    rawRows: number;
    excludedReview: number;
    excludedCityCode: number;
    excludedConflict: number;
    deduplicated: number;
    recordCount: number;
    sourceCount: number;
    cityCount: number;
  };
};

export function projectionPath(mode = process.env.NODE_ENV): string {
  return mode === "production"
    ? join(process.cwd(), "data", "gd-public-release.json")
    : join(process.cwd(), "data", "whitelist", "gd-public-preview.json");
}

export function previewModeActive(mode: string | undefined, flag: string | undefined): boolean {
  return mode !== "production" && flag === "1";
}

let cached: { path: string; mtimeMs: number; data: PublicGdProjection } | null = null;

export function getPublicProjection(): PublicGdProjection | null {
  if (process.env.NODE_ENV !== "production" && !previewModeActive(process.env.NODE_ENV, process.env.GD_PRIVATE_PREVIEW)) return null;
  const path = projectionPath();
  if (!existsSync(path)) return null;
  const mtimeMs = statSync(path).mtimeMs;
  if (cached?.path === path && cached.mtimeMs === mtimeMs) return cached.data;

  const data: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    !data || typeof data !== "object" ||
    !("records" in data) || !Array.isArray(data.records) ||
    !("sources" in data) || !Array.isArray(data.sources) ||
    !("preview" in data) || typeof data.preview !== "boolean"
  ) {
    throw new Error("广东官方名单投影格式无效");
  }
  if (process.env.NODE_ENV === "production" && data.preview) {
    throw new Error("预览数据不能用于正式发布");
  }
  if (process.env.NODE_ENV === "production") {
    assertPublicationSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  }
  cached = { path, mtimeMs, data: data as PublicGdProjection };
  return cached.data;
}

export type PublicListOptions = {
  citySlug?: string;
  sourceKind?: PublicSourceKind;
  q?: string;
  page?: number;
  pageSize?: number;
};

export function parsePageParam(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 1;
}

export function filterPublicRecords<T extends Pick<PublicGdRecord, "id" | "name" | "licenseNo" | "citySlug" | "county" | "sourceKind">>(
  records: T[],
  opts: PublicListOptions = {},
): { rows: T[]; total: number; page: number; pages: number } {
  const q = (opts.q ?? "").trim().slice(0, 60).toLocaleLowerCase("zh-CN");
  const filtered = records.filter((record) =>
    (!opts.citySlug || record.citySlug === opts.citySlug) &&
    (!opts.sourceKind || record.sourceKind === opts.sourceKind) &&
    (!q || record.name.toLocaleLowerCase("zh-CN").includes(q) || record.licenseNo.includes(q) || (record.county ?? "").toLocaleLowerCase("zh-CN").includes(q)),
  );
  filtered.sort((a, b) => a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id));
  const size = Math.min(50, Math.max(1, Math.trunc(opts.pageSize ?? 20) || 20));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(pages, Math.max(1, Math.trunc(opts.page ?? 1) || 1));
  return { rows: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, pages };
}

export function getPublicCityStats<T extends Pick<PublicGdRecord, "citySlug" | "city">>(records: T[]) {
  const counts = new Map<string, { citySlug: string; city: string; records: number }>();
  for (const record of records) {
    const value = counts.get(record.citySlug) ?? { citySlug: record.citySlug, city: record.city, records: 0 };
    value.records += 1;
    counts.set(record.citySlug, value);
  }
  return [...counts.values()].sort((a, b) => b.records - a.records || a.citySlug.localeCompare(b.citySlug));
}

export function getPublicRecord(id: string): PublicGdRecord | null {
  return getPublicProjection()?.records.find((record) => record.id === id) ?? null;
}
