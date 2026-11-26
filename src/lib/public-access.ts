export type PublicAccessDecision = "allow" | "redirect" | "not-found";

export function demoModeActive(nodeEnv: string | undefined, flag: string | undefined): boolean {
  return nodeEnv !== "production" && flag === "1";
}

/** Production is closed by default. The legacy prototype is opt-in for local demos. */
export function publicAccessDecision(pathname: string, demoEnabled: boolean): PublicAccessDecision {
  if (demoEnabled) return "allow";
  if (pathname === "/") return "redirect";
  if (pathname.startsWith("/_next/")) return "allow";
  if (["/favicon.ico", "/robots.txt", "/sitemap.xml"].includes(pathname)) return "allow";
  if (pathname === "/gd" || pathname === "/gd/license") return "allow";

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "gd" && parts.length === 3 && parts[1] === "org") return "allow";
  if (parts[0] === "gd" && parts[1] !== "org" && parts[1] !== "license" && (parts.length === 2 || parts.length === 3)) return "allow";

  // Never redirect an API request to HTML: integrations must see a clear failure.
  if (pathname === "/api" || pathname.startsWith("/api/") || pathname === "/llms.txt") return "not-found";
  return "redirect";
}
