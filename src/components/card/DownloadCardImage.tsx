"use client";
import { useState } from "react";
import type { CardView } from "@/lib/view/card-view";
import { Button } from "@/components/design-system";
import { useAnnounce } from "@/components/design-system/LiveRegionProvider";
import {
  DOWNLOAD_CARD_IMAGE,
  DOWNLOAD_CARD_IMAGE_DONE,
  DOWNLOAD_CARD_IMAGE_FAILED,
  DOWNLOAD_CARD_IMAGE_NOTE,
  DOWNLOAD_CARD_IMAGE_PREPARING,
} from "@/ui-copy/social";
import styles from "./Card.module.css";

/**
 * Renders the card to PNG on this device (SVG to canvas). The builder is loaded on click only,
 * so it adds nothing to the card route's first load. Nothing is sent anywhere.
 */
export function DownloadCardImage({ view, locationId }: { view: CardView; locationId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const announce = useAnnounce();

  async function download() {
    setState("busy");
    announce(DOWNLOAD_CARD_IMAGE_PREPARING);
    try {
      const { renderCardPng, cardImageFilename } = await import("./card-image");
      const blob = await renderCardPng(view);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cardImageFilename(locationId, view.header.eventDate);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("done");
      announce(DOWNLOAD_CARD_IMAGE_DONE);
    } catch {
      setState("failed");
      announce(DOWNLOAD_CARD_IMAGE_FAILED);
    }
  }

  return (
    <>
      <Button onClick={() => void download()} disabled={state === "busy"}>
        {DOWNLOAD_CARD_IMAGE}
      </Button>
      <p className={styles.muted}>
        {state === "failed"
          ? DOWNLOAD_CARD_IMAGE_FAILED
          : state === "done"
            ? DOWNLOAD_CARD_IMAGE_DONE
            : DOWNLOAD_CARD_IMAGE_NOTE}
      </p>
    </>
  );
}
