import { resolveSiteUrl } from "./site-url.mjs";
export { assertPublicationSiteUrl, resolveSiteUrl } from "./site-url.mjs";

export const site = {
  name: "教培网",
  // 正式发布须由运营方核验并配置真实域名；本机预览仅使用回环地址。
  url: resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  // These details are blank until ownership and registration are verified.
  legalName: "",
  icp: "",
  police: "",
  hotline: "",
  description:
    "广东校外培训机构公开名单索引。查询机构、办学许可相关记录及其发布来源；收录范围以已接入的名单为准。",
  // 所有统计数字的统一口径日期
  asOf: "2026-11-22",
};

export const absoluteUrl = (path: string) => new URL(path, site.url).toString();
