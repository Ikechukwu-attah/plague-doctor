/**
 * UI-3.1, UI-3.2, UI-18.2: build map geometry and city points.
 *
 * Dev-only. Downloads Natural Earth (public domain) admin-1 provinces and
 * populated places, simplifies with mapshaper, projects with d3-geo and writes
 * static JSON to src/data/geo/. Never invents geometry or coordinates: every
 * point is a Natural Earth populated place (or a cited override that points at
 * a Natural Earth place). Locations without a verified point are listed in
 * SOURCE.md and get no marker.
 *
 * Run: npm run geo:build
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { geoConicConformal, geoPath } from "d3-geo";
import { GAZETTEER } from "../src/server/geo/cities";

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "src", "data", "geo");
const WORK = path.join(tmpdir(), "plague-doctor-ne");
const BASE = "https://naciscdn.org/naturalearth/10m/cultural/";
const SOURCES = [
  {
    key: "admin1",
    file: "ne_10m_admin_1_states_provinces",
    page: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/",
  },
  {
    key: "places",
    file: "ne_10m_populated_places_simple",
    page: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/",
  },
] as const;

/** UI-20.5 to 20.7: ~16:9 box; the projection is fitted to the monitored points, territories are cropped. */
const VB_W = 1600;
const VB_H = 900;
/** Padding inside the box (room for the 24 px marker boxes and labels at the box edge). */
const PAD = 40;
const PROVINCES_SIZE_BUDGET = 80 * 1024;
const PROJECTED_SIZE_BUDGET = 120 * 1024;

/** SGC codes, same as the Gazetteer, plus NT and NU for outline completeness. */
const PRUID_BY_ISO: Record<string, string> = {
  "CA-NL": "10",
  "CA-PE": "11",
  "CA-NS": "12",
  "CA-NB": "13",
  "CA-QC": "24",
  "CA-ON": "35",
  "CA-MB": "46",
  "CA-SK": "47",
  "CA-AB": "48",
  "CA-BC": "59",
  "CA-YT": "60",
  "CA-NT": "61",
  "CA-NU": "62",
};

/**
 * Hand-checked overrides. Each maps a PHAC location name that is not itself a
 * Natural Earth place onto a named Natural Earth place, with a citation.
 * Coordinates always come from the Natural Earth place, never typed in here.
 */
const OVERRIDES: Record<
  string,
  { place: string; admin1: string; citation: string }
> = {
  "metro-vancouver": {
    place: "Vancouver",
    admin1: "British Columbia",
    citation:
      "Metro Vancouver is a regional district, not a Natural Earth place. Marker is placed at Vancouver, the place named in its PHAC sites (Vancouver Iona Island, Lions Gate, Lulu Island, Annacis Island); approximate. https://en.wikipedia.org/wiki/Metro_Vancouver_Regional_District",
  },
  "quebec-city": {
    place: "Québec",
    admin1: "Québec",
    citation:
      "Gazetteer name 'Quebec City' is the Natural Earth place 'Québec' (the provincial capital city, not the province). https://en.wikipedia.org/wiki/Quebec_City",
  },
  "cape-breton-regional-municipality": {
    place: "Sydney",
    admin1: "Nova Scotia",
    citation:
      "Cape Breton Regional Municipality is not a Natural Earth place. Marker is placed at Sydney, its largest community; approximate. https://en.wikipedia.org/wiki/Cape_Breton_Regional_Municipality",
  },
  "city-of-charlottetown-and-town-of-stratford": {
    place: "Charlottetown",
    admin1: "Prince Edward Island",
    citation:
      "PHAC location name covers Charlottetown and Stratford. Marker is placed at Charlottetown, the first place named; approximate. https://en.wikipedia.org/wiki/Charlottetown",
  },
};

interface NeProps {
  [k: string]: unknown;
}
interface Feature {
  type: "Feature";
  properties: NeProps;
  geometry: { type: string; coordinates: unknown };
}
interface FC {
  type: "FeatureCollection";
  features: Feature[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

type Downloaded = { admin1: { url: string; sha256: string }; places: { url: string; sha256: string } };

function download(): Downloaded {
  mkdirSync(WORK, { recursive: true });
  const info: Record<string, { url: string; sha256: string }> = {};
  for (const s of SOURCES) {
    const zip = path.join(WORK, `${s.file}.zip`);
    const url = `${BASE}${s.file}.zip`;
    if (!existsSync(zip)) {
      console.log(`Downloading ${url}`);
      execFileSync("curl", ["-fsSL", "--max-time", "300", "-o", zip, url], {
        stdio: "inherit",
      });
    }
    execFileSync("unzip", ["-oq", zip, "-d", WORK]);
    if (!existsSync(path.join(WORK, `${s.file}.shp`))) {
      throw new Error(`Missing ${s.file}.shp after unzip; refusing to continue`);
    }
    info[s.key] = { url, sha256: sha256(zip) };
  }
  return info as Downloaded;
}

function mapshaper(args: string[]): void {
  const bin = path.join(ROOT, "node_modules", ".bin", "mapshaper");
  execFileSync(bin, args, { stdio: "inherit" });
}

function readFC(file: string): FC {
  return JSON.parse(readFileSync(file, "utf8")) as FC;
}

function main(): void {
  const sources = download();
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Provinces: Canada only, simplified.
  const provTmp = path.join(WORK, "provinces.raw.json");
  const placesTmp = path.join(WORK, "places.raw.json");
  const simplify = process.env.GEO_SIMPLIFY ?? "5%";
  mapshaper([
    path.join(WORK, `${SOURCES[0].file}.shp`),
    "encoding=utf8",
    "-filter",
    'iso_a2 == "CA"',
    "-filter-fields",
    "iso_3166_2,name",
    "-simplify",
    simplify,
    "keep-shapes",
    "-o",
    provTmp,
    "format=geojson",
    "precision=0.01",
    "rfc7946",
    "force",
  ]);
  mapshaper([
    path.join(WORK, `${SOURCES[1].file}.shp`),
    "encoding=utf8",
    "-filter",
    'iso_a2 == "CA"',
    "-filter-fields",
    "name,nameascii,adm1name,latitude,longitude,ne_id,pop_max",
    "-o",
    placesTmp,
    "format=geojson",
    "force",
  ]);

  const provRaw = readFC(provTmp);
  const provinces: FC = {
    type: "FeatureCollection",
    features: provRaw.features.map((f) => {
      const iso = String(f.properties.iso_3166_2);
      const pruid = PRUID_BY_ISO[iso];
      if (!pruid) throw new Error(`Unmapped province code ${iso}`);
      return {
        type: "Feature",
        properties: { pruid, name: String(f.properties.name) },
        geometry: f.geometry,
      };
    }),
  };
  if (provinces.features.length !== 13) {
    throw new Error(`Expected 13 provinces/territories, got ${provinces.features.length}`);
  }
  provinces.features.sort((a, b) =>
    String(a.properties.pruid).localeCompare(String(b.properties.pruid))
  );
  const provText = JSON.stringify(provinces);
  writeFileSync(path.join(OUT_DIR, "canada-provinces.geojson"), provText);

  // 2. Projection (conic conformal), pre-projected paths.
  const parallels: [number, number] = [49, 77];
  const rotate: [number, number] = [96, 0];
  const projection = geoConicConformal().parallels(parallels).rotate(rotate);
  // d3-geo wants clockwise exterior rings; RFC 7946 files are counter-clockwise.
  const rev = (rings: number[][][]): number[][][] =>
    rings.map((r) => [...r].reverse());
  const fc = {
    type: "FeatureCollection",
    features: provinces.features.map((f) => ({
      ...f,
      geometry:
        f.geometry.type === "Polygon"
          ? { type: "Polygon", coordinates: rev(f.geometry.coordinates as number[][][]) }
          : {
              type: "MultiPolygon",
              coordinates: (f.geometry.coordinates as number[][][][]).map(rev),
            },
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  // 3. City points.
  const places = readFC(placesTmp).features;
  interface Cand {
    place: string;
    admin1: string;
    lon: number;
    lat: number;
    neId: number;
  }
  const cands: Cand[] = places.map((f) => ({
    place: String(f.properties.name),
    admin1: String(f.properties.adm1name),
    lon: Number(f.properties.longitude),
    lat: Number(f.properties.latitude),
    neId: Number(f.properties.ne_id),
  }));
  const place = (name: string, admin1?: string): Cand[] =>
    cands.filter(
      (c) =>
        fold(c.place) === fold(name) && (!admin1 || fold(c.admin1) === fold(admin1))
    );

  // Location keys derived from the current snapshot and the Gazetteer.
  const trend = JSON.parse(
    readFileSync(path.join(ROOT, "data", "normalized", "trend-latest.json"), "utf8")
  ) as Array<{
    locationId: string;
    locationName: string;
    city?: string;
    province?: string;
    grouping: string;
  }>;
  const keys = new Map<string, { name: string; province?: string }>();
  const siteIds = new Set(
    trend.filter((r) => r.grouping === "site").map((r) => r.locationId)
  );
  for (const r of trend) {
    if (r.grouping === "city") {
      keys.set(r.locationId, { name: r.locationName, province: r.province });
    } else if (r.grouping === "site" && r.city) {
      const k = slugify(r.city);
      if (!keys.has(k)) keys.set(k, { name: r.city, province: r.province });
    }
  }
  for (const [slug, g] of GAZETTEER) {
    if (siteIds.has(slug) && !keys.has(slug)) continue; // site-level slug, folded under its city
    if (!keys.has(slug)) keys.set(slug, { name: g.cityName, province: g.province });
  }

  const entries: Record<
    string,
    {
      lon: number;
      lat: number;
      x: number;
      y: number;
      place: string;
      neId: number;
      citation?: string;
    }
  > = {};
  const unmatched: string[] = [];
  const overridesUsed: string[] = [];

  for (const [key, info] of [...keys].sort((a, c) => a[0].localeCompare(c[0]))) {
    let match: Cand | undefined;
    let citation: string | undefined;
    const ov = OVERRIDES[key];
    if (ov) {
      const m = place(ov.place, ov.admin1);
      if (m.length === 1) {
        match = m[0];
        citation = ov.citation;
        overridesUsed.push(key);
      }
    } else {
      const m = place(info.name, info.province);
      if (m.length === 1) match = m[0];
    }
    if (!match) {
      unmatched.push(`${key} (${info.name}${info.province ? `, ${info.province}` : ""})`);
      continue;
    }
    entries[key] = {
      lon: match.lon,
      lat: match.lat,
      x: 0,
      y: 0,
      place: match.place,
      neId: match.neId,
      ...(citation ? { citation } : {}),
    };
  }

  // Fit the projection to ALL known city points (the populated band fills the box width). Provinces are drawn
  // in the same space and clipped to the box, so territories are cropped instead of shrinking the fit.
  const pointGeo = {
    type: "MultiPoint" as const,
    coordinates: Object.values(entries).map((e) => [e.lon, e.lat]),
  };
  if (pointGeo.coordinates.length === 0) throw new Error("No city points; refusing to fit");
  projection.fitExtent(
    [
      [PAD, PAD],
      [VB_W - PAD, VB_H - PAD],
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pointGeo as any,
  );
  for (const [key, e] of Object.entries(entries)) {
    const xy = projection([e.lon, e.lat]);
    if (!xy || xy[0] < 0 || xy[0] > VB_W || xy[1] < 0 || xy[1] > VB_H) {
      throw new Error(`${key} falls outside the fitted box`);
    }
    e.x = Math.round(xy[0] * 10) / 10;
    e.y = Math.round(xy[1] * 10) / 10;
  }
  projection.clipExtent([
    [0, 0],
    [VB_W, VB_H],
  ]);
  const path0 = geoPath(projection).digits(1);
  const projected = {
    viewBox: [VB_W, VB_H] as [number, number],
    projection: { type: "conicConformal", parallels, rotate },
    provinces: provinces.features.map((f, i) => ({
      pruid: String(f.properties.pruid),
      name: String(f.properties.name),
      d: path0(fc.features[i]) ?? "",
    })),
  };
  const projText = JSON.stringify(projected);
  writeFileSync(path.join(OUT_DIR, "canada-provinces.projected.json"), projText);

  const generatedAt = new Date().toISOString().slice(0, 10);
  const pointsDoc = {
    source: "Natural Earth 1:10m populated places (public domain)",
    generatedAt,
    viewBox: projected.viewBox,
    entries,
  };
  writeFileSync(
    path.join(OUT_DIR, "city-points.json"),
    JSON.stringify(pointsDoc, null, 1) + "\n"
  );

  // 4. SOURCE.md
  const md = `# Map geometry sources

All files in this directory are generated by \`scripts/build-geometry.ts\`. Do not edit by hand.

## Sources (public domain)

Natural Earth data is in the public domain (https://www.naturalearthdata.com/about/terms-of-use/). No attribution is required; we credit it anyway.

- Admin-1 states and provinces, 1:10m: ${sources.admin1.url}
  - SHA-256 of download: \`${sources.admin1.sha256}\`
  - Page: ${SOURCES[0].page}
- Populated places (simple), 1:10m: ${sources.places.url}
  - SHA-256 of download: \`${sources.places.sha256}\`
  - Page: ${SOURCES[1].page}

Downloaded: ${generatedAt}

## Processing

- Provinces filtered to Canada (13 provinces and territories) and simplified with mapshaper (\`${simplify}\`, keep-shapes). Output is \`canada-provinces.geojson\` (properties \`pruid\`, \`name\`).
- Pre-projected with d3-geo conic conformal (parallels ${parallels.join(", ")}, rotate ${rotate.join(", ")}), viewBox ${projected.viewBox.join(" x ")} (about 16:9), into \`canada-provinces.projected.json\`. The projection is fitted with \`fitExtent\` (padding ${PAD}) over every point in \`city-points.json\`, so the populated southern band fills the width; the outlines are clipped to the box (\`clipExtent\`), which crops the northern territories at the top edge instead of shrinking the map to include them. Outlines and points share this one projected space.
- \`city-points.json\`: a location gets a point only if its name (and province, when known) matches exactly one Natural Earth populated place, or it has a hand-checked override carrying a \`citation\`. Coordinates always come from Natural Earth. Outlines are decorative; no data is attached to them.

## Regenerate

\`\`\`
npm run geo:build
\`\`\`

Location keys come from \`data/normalized/trend-latest.json\` (city names and the \`city\` of each site) plus the Gazetteer in \`src/server/geo/cities.ts\`.

## Overrides used (approximate markers, see citation per entry in city-points.json)

${overridesUsed.length ? overridesUsed.map((k) => `- ${k}`).join("\n") : "None."}

## Locations without a point (no marker; list only)

${unmatched.length ? unmatched.map((u) => `- ${u}`).join("\n") : "None."}
`;
  writeFileSync(path.join(OUT_DIR, "SOURCE.md"), md);

  console.log(
    `canada-provinces.geojson ${provText.length} B (budget ${PROVINCES_SIZE_BUDGET})`
  );
  console.log(
    `canada-provinces.projected.json ${projText.length} B (budget ${PROJECTED_SIZE_BUDGET})`
  );
  console.log(`points: ${Object.keys(entries).length}, unmatched: ${unmatched.length}`);
  if (provText.length > PROVINCES_SIZE_BUDGET || projText.length > PROJECTED_SIZE_BUDGET) {
    console.error("Size budget exceeded; re-run with a smaller GEO_SIMPLIFY (e.g. GEO_SIMPLIFY=0.8%)");
    process.exit(1);
  }
}

main();
