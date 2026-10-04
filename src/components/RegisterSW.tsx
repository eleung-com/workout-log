"use client";
import { useEffect } from "react";
import { BASE } from "@/lib/base";

/** Offline support: the service worker caches the whole app after the first visit. */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {});
  }, []);
  return null;
}
