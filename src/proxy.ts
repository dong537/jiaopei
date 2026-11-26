import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { demoModeActive, publicAccessDecision } from "./lib/public-access";

export function proxy(request: NextRequest) {
  const decision = publicAccessDecision(request.nextUrl.pathname, demoModeActive(process.env.NODE_ENV, process.env.SITE_DEMO_MODE));
  if (decision === "allow") return NextResponse.next();
  if (decision === "not-found" || (request.method !== "GET" && request.method !== "HEAD")) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.redirect(new URL("/gd", request.url));
}

export const config = { matcher: "/:path*" };
