/**
 * Data attribution line — UI-11.1, UI-11.7, UI-14.5.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { checkWording } from "../../src/evidence/wording-guard";
import { DATA_ATTRIBUTION, dataAttributionText } from "../../src/ui-copy";
import { SiteFooter } from "../../src/components/shell/SiteFooter";
import { SourceList } from "../../src/components/methods/SourceList";

const EXACT =
  "Data: Wastewater monitoring dashboard: Respiratory virus activity, Public Health Agency of Canada. Reproduced from health-infobase.canada.ca/wastewater; not an official version and not affiliated with PHAC.";

const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'");

describe("UI-11.7 data attribution", () => {
  it("parts concatenate to the exact text", () => {
    expect(dataAttributionText()).toBe(EXACT);
    expect(DATA_ATTRIBUTION.linkText).toBe("health-infobase.canada.ca/wastewater");
    expect(DATA_ATTRIBUTION.href).toBe("https://health-infobase.canada.ca/wastewater/");
  });

  it("UI-14.5 passes the wording guard", () => {
    expect(checkWording(EXACT).violations).toEqual([]);
  });

  for (const [name, Comp] of [
    ["footer", SiteFooter],
    ["methods sources", SourceList],
  ] as const) {
    it(`appears in the ${name} with the link`, () => {
      const html = renderToStaticMarkup(<Comp />);
      expect(strip(html)).toContain(EXACT);
      expect(html).toContain(
        `<a href="https://health-infobase.canada.ca/wastewater/" rel="noopener noreferrer">health-infobase.canada.ca/wastewater</a>`,
      );
    });
  }
});
