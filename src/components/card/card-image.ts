/**
 * Card to PNG (UI-19.31, doc item 16.12). Pure SVG string builder plus a browser-only rasteriser.
 *
 * Privacy: the builder reads only the fields the share text also uses (title, place, event date,
 * per-virus level and week, caveat, source). It reads no who-is-attending field, and the file
 * name never includes anything but the location id and event date.
 * No external references: the SVG is rendered through a data: URI with system fonts only.
 */
import type { CardView, NearRowView } from "@/lib/view/card-view";
import { PAST_OBSERVATIONS_LABEL, SOURCE_LINE, caveatSentence, historicalBand, historicalGap, historicalMeasured } from "@/ui-copy/card";
import { VIRUS_LABEL } from "@/ui-copy/levels";
import { weekOf } from "@/ui-copy/timing";
import { CARD_IMAGE_NO_ROWS, SOCIAL_SITE_NAME, cardImageEventDate, cardImageRow } from "@/ui-copy/social";

const WIDTH = 1080;
const PAD = 56;
const SCALE = 2;
const INK = "#0B1020";
const PARCHMENT = "#EADFC8";
const DIM = "#B9AE98";
const LANTERN = "#F2B544";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "system-ui, 'Segoe UI', Helvetica, Arial, sans-serif";

interface Line {
  text: string;
  size: number;
  bold?: boolean;
  fill: string;
  serif?: boolean;
  gapBefore?: number;
}

export interface CardImage {
  svg: string;
  width: number;
  height: number;
}

/** Escapes text for XML and drops characters XML 1.0 cannot carry. */
export function escapeXml(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word wrap by approximate glyph width. */
function wrap(text: string, size: number): string[] {
  const maxChars = Math.max(10, Math.floor((WIDTH - PAD * 2) / (size * 0.56)));
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > maxChars) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      out.push(w.slice(0, maxChars));
      w = w.slice(maxChars);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function nearLines(row: NearRowView, lines: Line[]): void {
  const virus = VIRUS_LABEL[row.pathogen];
  const icon = row.badge.kind === "level" ? `${row.badge.icon} ` : "";
  lines.push({
    text: cardImageRow({ virus, level: `${icon}${row.badge.word}` }),
    size: 30,
    bold: true,
    fill: PARCHMENT,
    gapBefore: 14,
  });
  if (row.weekStart) lines.push({ text: weekOf(row.weekStart), size: 22, fill: DIM });
  else if (row.unknownText) lines.push({ text: row.unknownText, size: 22, fill: DIM });
  if (row.regionLabel) lines.push({ text: row.regionLabel, size: 22, fill: DIM });
}

function contentLines(view: CardView): Line[] {
  const h = view.header;
  const lines: Line[] = [];
  lines.push({ text: h.title, size: 44, bold: true, fill: PARCHMENT, serif: true, gapBefore: 10 });
  lines.push({ text: cardImageEventDate({ date: h.eventDate }), size: 24, fill: LANTERN, gapBefore: 6 });

  if (view.timing === "near") {
    lines.push({ text: view.observedStrip, size: 22, fill: DIM, gapBefore: 26 });
    if (view.regionalNotice) lines.push({ text: view.regionalNotice, size: 22, fill: DIM, gapBefore: 6 });
    for (const row of view.rows) nearLines(row, lines);
    if (view.rows.length === 0) lines.push({ text: CARD_IMAGE_NO_ROWS, size: 24, fill: DIM, gapBefore: 14 });
  } else if (view.timing === "too_early") {
    lines.push({ text: view.headline, size: 32, bold: true, fill: PARCHMENT, serif: true, gapBefore: 26 });
    lines.push({ text: view.sentence, size: 24, fill: PARCHMENT, gapBefore: 6 });
    for (const r of view.rows) {
      lines.push({
        text: historicalBand({ virus: r.pathogen, place: h.place, min: r.histMin, max: r.histMax }),
        size: 21,
        fill: DIM,
        gapBefore: 14,
      });
    }
  } else {
    lines.push({ text: PAST_OBSERVATIONS_LABEL, size: 22, fill: DIM, gapBefore: 26 });
    for (const r of view.rows) {
      const text =
        r.weekStart && r.wAvg != null
          ? historicalMeasured({ virus: r.pathogen, place: h.place, week: r.weekStart, wAvg: r.wAvg })
          : historicalGap({ virus: r.pathogen, place: h.place });
      lines.push({ text, size: 22, fill: PARCHMENT, gapBefore: 14 });
    }
  }

  lines.push({ text: caveatSentence(), size: 24, bold: true, fill: LANTERN, gapBefore: 34 });
  lines.push({ text: SOURCE_LINE, size: 20, fill: DIM, gapBefore: 18 });
  if (h.sourceUrl) lines.push({ text: h.sourceUrl, size: 18, fill: DIM, gapBefore: 4 });
  return lines;
}

/** Builds the card as a self-contained SVG string. Deterministic; no I/O. */
export function buildCardImage(view: CardView): CardImage {
  const body: string[] = [];
  // Brand row: bird glyph (same path as the site icon) and the site name.
  const top = PAD;
  body.push(
    `<g transform="translate(${PAD} ${top}) scale(1.6)" fill="none" stroke="${LANTERN}" stroke-width="1.6" stroke-linejoin="round">` +
      `<path d="M6 13c0-5 4-9 9-9s8 4 8 8l9 9-11-2c-1 4-4 7-8 7-4 0-7-4-7-9z"/><circle cx="13" cy="12" r="2.4"/></g>`,
  );
  body.push(
    `<text x="${PAD + 74}" y="${top + 38}" font-family="${SERIF}" font-size="34" font-weight="700" fill="${PARCHMENT}">${escapeXml(SOCIAL_SITE_NAME)}</text>`,
  );
  let y = top + 64 + 20;
  body.push(`<line x1="${PAD}" y1="${y}" x2="${WIDTH - PAD}" y2="${y}" stroke="#1C2742" stroke-width="2"/>`);

  for (const line of contentLines(view)) {
    y += line.gapBefore ?? 0;
    for (const part of wrap(line.text, line.size)) {
      y += Math.round(line.size * 1.3);
      body.push(
        `<text x="${PAD}" y="${y}" font-family="${line.serif ? SERIF : SANS}" font-size="${line.size}"` +
          `${line.bold ? ' font-weight="700"' : ""} fill="${line.fill}">${escapeXml(part)}</text>`,
      );
    }
  }
  const height = y + PAD;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">` +
    `<rect width="${WIDTH}" height="${height}" fill="${INK}"/>` +
    body.join("") +
    `</svg>`;
  return { svg, width: WIDTH, height };
}

export function buildCardSvg(view: CardView): string {
  return buildCardImage(view).svg;
}

/** `plague-doctor-card-{loc}-{eventDate}.png`; only the location id and event date, sanitised. */
export function cardImageFilename(locationId: string, eventDate: string): string {
  const loc =
    locationId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "location";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : "undated";
  return `plague-doctor-card-${loc}-${date}.png`;
}

/** Rasterises the card to a PNG blob. Browser only; rejects if canvas or toBlob is unavailable. */
export async function renderCardPng(view: CardView): Promise<Blob> {
  const { svg, width, height } = buildCardImage(view);
  const img = new Image();
  img.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("card image could not be decoded"));
  });
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await loaded;

  const canvas = document.createElement("canvas");
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas is not available");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas could not export a PNG"))), "image/png");
  });
}
