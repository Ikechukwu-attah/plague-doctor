import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageContainer } from "../../src/components/shell/PageContainer";

describe("PageContainer (UI-1.1, UI-13.2)", () => {
  it("renders a plain wrapper with no landmark", () => {
    const html = renderToStaticMarkup(<PageContainer>hi</PageContainer>);
    expect(html.startsWith("<div")).toBe(true);
    expect(html).not.toContain("<main");
    expect(html).not.toContain("role=");
    expect(html).toContain('data-variant="default"');
  });

  it("supports the city variant and extra class", () => {
    const html = renderToStaticMarkup(
      <PageContainer variant="city" className="extra">
        x
      </PageContainer>,
    );
    expect(html).toContain('data-variant="city"');
    expect(html).toContain("extra");
  });

  it("is used by every content route", () => {
    for (const f of [
      "src/app/plan/page.tsx",
      "src/app/card/page.tsx",
      "src/app/methods/page.tsx",
      "src/app/city/[locationId]/page.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, f).toContain("<PageContainer");
    }
  });
});
