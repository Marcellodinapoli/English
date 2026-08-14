"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Boots native-only plugins when running inside the store shell (Capacitor).
 * Safe no-op on web browsers.
 */
export function NativeShellBootstrap() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    async function boot() {
      try {
        const [{ StatusBar, Style }, { SplashScreen }, { App }, { Keyboard }] =
          await Promise.all([
            import("@capacitor/status-bar"),
            import("@capacitor/splash-screen"),
            import("@capacitor/app"),
            import("@capacitor/keyboard"),
          ]);

        if (cancelled) return;

        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#132033" }).catch(
          () => undefined
        );
        await SplashScreen.hide().catch(() => undefined);

        const back = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });

        const show = await Keyboard.addListener("keyboardWillShow", () => {
          document.documentElement.dataset.keyboard = "open";
        });
        const hide = await Keyboard.addListener("keyboardWillHide", () => {
          delete document.documentElement.dataset.keyboard;
        });

        return () => {
          back.remove();
          show.remove();
          hide.remove();
        };
      } catch {
        // Plugins may be unavailable during web testing
      }
    }

    let cleanup: (() => void) | undefined;
    boot().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
