/** @param {string | undefined} configured */
export function resolveSiteUrl(configured) {
  if (!configured?.trim()) return "http://127.0.0.1:3111";
  const url = new URL(configured.trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL 必须是没有路径、账号或参数的站点地址");
  }
  return url.origin;
}

/** @param {string | undefined} configured */
export function assertPublicationSiteUrl(configured) {
  if (!configured?.trim()) throw new Error("正式发布前必须配置并核验 NEXT_PUBLIC_SITE_URL");
  const origin = resolveSiteUrl(configured);
  const url = new URL(origin);
  if (url.protocol !== "https:") throw new Error("正式发布域名必须使用 HTTPS");
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.hostname.endsWith(".invalid")) {
    throw new Error("正式发布域名不能是本机或保留域名");
  }
  return origin;
}
