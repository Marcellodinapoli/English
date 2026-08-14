/**
 * Platform awareness for web, PWA and native store shells (Capacitor).
 */

import { Capacitor } from "@capacitor/core";

export type AppPlatform =
  | "web"
  | "ios"
  | "android"
  | "desktop-pwa"
  | "ios-native"
  | "android-native";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function detectPlatform(): AppPlatform {
  if (typeof window === "undefined") return "web";

  if (Capacitor.isNativePlatform()) {
    const p = Capacitor.getPlatform();
    if (p === "ios") return "ios-native";
    if (p === "android") return "android-native";
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone
      ));

  if (/iphone|ipad|ipod/.test(ua)) return standalone ? "ios" : "web";
  if (/android/.test(ua)) return standalone ? "android" : "web";
  if (standalone) return "desktop-pwa";
  return "web";
}

export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    Capacitor.isNativePlatform() ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function supportsSpeechSynthesis() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function supportsMediaRecorder() {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined";
}

/** Prefer native-friendly UX when inside store builds. */
export function prefersNativeChrome() {
  return isNativeApp() || detectPlatform() !== "web";
}