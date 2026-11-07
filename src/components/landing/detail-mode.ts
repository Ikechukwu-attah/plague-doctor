"use client";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

export type DetailMode = "drawer" | "sheet" | "page";

/** UI-5.9: 400 px drawer at 1024 px and up, bottom sheet 768-1023, navigation below 768. */
export function detailModeForWidth(width: number): DetailMode {
  return width >= 1024 ? "drawer" : width >= 768 ? "sheet" : "page";
}

/** "page" means the opener should navigate to /city/{id} instead of rendering a surface. */
export function useDetailMode(): DetailMode {
  const wide = useMediaQuery("(min-width: 1024px)");
  const medium = useMediaQuery("(min-width: 768px)");
  return wide ? "drawer" : medium ? "sheet" : "page";
}
