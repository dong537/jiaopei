import test from "node:test";
import assert from "node:assert/strict";
import { publicAccessDecision, demoModeActive } from "../src/lib/public-access.ts";

test("formal mode sends the home page to Guangdong", () => {
  assert.equal(publicAccessDecision("/", false), "redirect");
});

test("formal mode serves the public Guangdong directory and source pages", () => {
  for (const path of ["/gd", "/gd/license", "/gd/org/123", "/gd/guangzhou", "/gd/guangzhou/arts"]) {
    assert.equal(publicAccessDecision(path, false), "allow", path);
  }
});

test("formal mode blocks the mock API and text feed", () => {
  for (const path of ["/api/public/v1/orgs", "/llms.txt"]) {
    assert.equal(publicAccessDecision(path, false), "not-found", path);
  }
});

test("formal mode redirects prototype pages and lets assets load", () => {
  for (const path of ["/org/example", "/course/example", "/rankings/guangzhou/yasi", "/search", "/merchant"]) {
    assert.equal(publicAccessDecision(path, false), "redirect", path);
  }
  for (const path of ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/_next/static/chunks/app.js", "/_next/image"]) {
    assert.equal(publicAccessDecision(path, false), "allow", path);
  }
});

test("explicit demo mode retains prototype routes", () => {
  for (const path of ["/", "/org/example", "/api/public/v1/orgs"]) {
    assert.equal(publicAccessDecision(path, true), "allow", path);
  }
});

test("production never enables prototype mode via environment flag", () => {
  assert.equal(demoModeActive("production", "1"), false);
  assert.equal(demoModeActive("development", "1"), true);
});
