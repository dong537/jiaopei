"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { cityDirectory } from "@/lib/cities";

const key = "jiaopei:selected-city";
const event = "jiaopei:city-change";
let memoryCity = "guangzhou";
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(event, listener); window.removeEventListener("storage", listener); };
};
const snapshot = () => { try { return localStorage.getItem(key) ?? memoryCity; } catch { return memoryCity; } };
const serverSnapshot = () => "guangzhou";

export function selectCity(slug: string) {
  memoryCity = slug;
  try { localStorage.setItem(key, slug); } catch { /* In private browsing, retain the selection for this session. */ }
  window.dispatchEvent(new Event(event));
}

export function useSelectedCity() {
  const pathname = usePathname();
  const stored = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const routeCity = /^\/(?:city|rankings)\/([^/]+)/.exec(pathname)?.[1];
  return cityDirectory.find(c => c.slug === (routeCity ?? stored)) ?? cityDirectory.find(c => c.slug === "guangzhou")!;
}
