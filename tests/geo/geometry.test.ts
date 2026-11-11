import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { geoConicConformal } from "d3-geo";

// UI-3.1, UI-3.2, UI-18.2: map geometry and city points (real Natural Earth output).
const GEO = join(process.cwd(), "src/data/geo");
const read = (f: string): string => readFileSync(join(GEO, f), "utf8");

const GeoJsonSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        properties: z.object({ pruid: z.string().min(1), name: z.string().min(1) }),
        geometry: z.object({
          type: z.enum(["Polygon", "MultiPolygon"]),
          coordinates: z.array(z.unknown()).min(1),
        }),
      }),
    )
    .min(1),
});

const ProjectedSchema = z.object({
  viewBox: z.tuple([z.number().positive(), z.number().positive()]),
  projection: z.object({
    type: z.string(),
    parallels: z.array(z.number()),
    rotate: z.array(z.number()),
  }),
  provinces: z
    .array(
      z.object({
        pruid: z.string().min(1),
        name: z.string().min(1),
        d: z.string().min(1),
      }),
    )
    .min(1),
});

const PointsSchema = z.object({
  source: z.string(),
  generatedAt: z.string(),
  viewBox: z.tuple([z.number().positive(), z.number().positive()]),
  entries: z.record(
    z.string(),
    z.object({
      lon: z.number(),
      lat: z.number(),
      x: z.number(),
      y: z.number(),
      place: z.string().min(1),
      neId: z.number().optional(),
      citation: z.string().optional(),
    }),
  ),
});

describe("UI-3.1 UI-18.2: geometry files", () => {
  it("parses canada-provinces.geojson and stays within 80 KB", () => {
    const g = GeoJsonSchema.parse(JSON.parse(read("canada-provinces.geojson")));
    expect(g.features.length).toBe(13);
    expect(statSync(join(GEO, "canada-provinces.geojson")).size).toBeLessThanOrEqual(80 * 1024);
  });

  it("parses canada-provinces.projected.json and stays within 120 KB", () => {
    const p = ProjectedSchema.parse(JSON.parse(read("canada-provinces.projected.json")));
    expect(p.provinces.length).toBe(13);
    expect(statSync(join(GEO, "canada-provinces.projected.json")).size).toBeLessThanOrEqual(
      120 * 1024,
    );
  });

  it("geojson and projected files describe the same provinces", () => {
    const g = GeoJsonSchema.parse(JSON.parse(read("canada-provinces.geojson")));
    const p = ProjectedSchema.parse(JSON.parse(read("canada-provinces.projected.json")));
    const ids = (xs: { properties?: { pruid: string }; pruid?: string }[]): string[] =>
      xs.map((x) => x.properties?.pruid ?? x.pruid ?? "").sort();
    expect(ids(p.provinces)).toEqual(ids(g.features));
  });
});

describe("UI-3.2 UI-18.2: SOURCE.md", () => {
  const md = read("SOURCE.md");
  it("names Natural Earth and public domain", () => {
    expect(md).toMatch(/Natural Earth/);
    expect(md).toMatch(/public domain/i);
  });
});

describe("UI-3.2 UI-18.2: city-points.json", () => {
  const projected = ProjectedSchema.parse(JSON.parse(read("canada-provinces.projected.json")));
  const points = PointsSchema.parse(JSON.parse(read("city-points.json")));
  const [w, h] = projected.viewBox;

  it("uses the same viewBox as the projected provinces", () => {
    expect(points.viewBox).toEqual(projected.viewBox);
  });

  it("UI-20.5 UI-20.7: viewBox is about 16:9 and the points span the width (fitExtent, ~24+ px padding)", () => {
    expect(w / h).toBeGreaterThan(1.7);
    expect(w / h).toBeLessThan(1.85);
    const xs = Object.values(points.entries).map((p) => p.x);
    const ys = Object.values(points.entries).map((p) => p.y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(24);
    expect(Math.max(...xs)).toBeLessThanOrEqual(w - 24);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(24);
    expect(Math.max(...ys)).toBeLessThanOrEqual(h - 24);
    // The populated band fills the width: the points cover at least 90 % of the box width.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(w * 0.9);
  });
  it("UI-20.6: outlines are clipped to the viewBox (territories cropped, not shrunk to fit)", () => {
    // Every coordinate in the path data lies inside the box (clipExtent), so nothing is drawn past the crop.
    for (const prov of projected.provinces) {
      const nums = prov.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        expect(nums[i]!, prov.pruid).toBeGreaterThanOrEqual(-0.5);
        expect(nums[i]!, prov.pruid).toBeLessThanOrEqual(w + 0.5);
        expect(nums[i + 1]!, prov.pruid).toBeGreaterThanOrEqual(-0.5);
        expect(nums[i + 1]!, prov.pruid).toBeLessThanOrEqual(h + 0.5);
      }
    }
  });
  it("UI-20.7: lon/lat are kept and every point is in the same projected space as the outlines (no invented coordinates)", () => {
    // Re-project lon/lat with the recorded projection, fitted to the same points; x/y must match within rounding.
    const entries = Object.values(points.entries);
    const proj = geoConicConformal()
      .parallels(projected.projection.parallels as [number, number])
      .rotate(projected.projection.rotate as [number, number]);
    proj.fitExtent(
      [
        [40, 40],
        [w - 40, h - 40],
      ],
      { type: "MultiPoint", coordinates: entries.map((p) => [p.lon, p.lat]) },
    );
    for (const [id, p] of Object.entries(points.entries)) {
      const xy = proj([p.lon, p.lat])!;
      expect(Math.abs(xy[0] - p.x), id).toBeLessThanOrEqual(0.06);
      expect(Math.abs(xy[1] - p.y), id).toBeLessThanOrEqual(0.06);
    }
  });
  it("every point lies inside the viewBox", () => {
    for (const [id, p] of Object.entries(points.entries)) {
      expect(p.x, id).toBeGreaterThanOrEqual(0);
      expect(p.x, id).toBeLessThanOrEqual(w);
      expect(p.y, id).toBeGreaterThanOrEqual(0);
      expect(p.y, id).toBeLessThanOrEqual(h);
    }
  });

  it("every override (place name differs from the location) carries a citation", () => {
    const names = new Map(
      Object.entries(points.entries).map(([id, p]) => [id, p.place.toLowerCase()]),
    );
    const slug = (s: string): string =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    for (const [id, p] of Object.entries(points.entries)) {
      if (slug(names.get(id)!) !== id) {
        expect(p.citation, id).toBeTruthy();
      }
      if (p.citation !== undefined) {
        expect(p.citation.length, id).toBeGreaterThan(20);
      }
    }
    // Every override listed in SOURCE.md has a citation in the data.
    const section = read("SOURCE.md").split("## Overrides used")[1]?.split("## Locations without")[0] ?? "";
    const listed = [...section.matchAll(/^- (\S+)$/gm)].map((m) => m[1]!);
    expect(listed.length).toBeGreaterThan(0);
    for (const id of listed) {
      expect(points.entries[id]?.citation, id).toBeTruthy();
    }
  });

  it("no point exists for locations SOURCE.md lists as unmatched", () => {
    const section = read("SOURCE.md").split("## Locations without a point")[1] ?? "";
    const unmatched = [...section.matchAll(/^- (\S+) \(/gm)].map((m) => m[1]!);
    expect(unmatched.length).toBeGreaterThan(0);
    for (const id of unmatched) {
      expect(points.entries[id], id).toBeUndefined();
    }
  });
});
