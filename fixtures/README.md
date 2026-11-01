# Fixtures

Test fixtures are **real PHAC bytes** copied verbatim via `grep`/`head` from full
downloads. No values are invented. Synthetic fixtures are labelled `synthetic` in
the filename.

---

## trend-oct-2026.real.csv

| Field | Value |
|---|---|
| Source URL | https://health-infobase.canada.ca/src/data/wastewater/wastewater_trend.csv |
| HTTP Last-Modified | Wed, 28 Oct 2026 16:49:48 GMT |
| Retrieved | 2026-10-31 |
| Full download saved as | `fixtures/raw-trend.csv` (gitignored — too large) |

**How it was built:**

```
curl -sL <URL> -o fixtures/raw-trend.csv
head -1 fixtures/raw-trend.csv > fixtures/trend-oct-2026.real.csv
grep -E '^(Toronto,|Ontario,|Halifax,|Halifax Halifax,|Halifax Millcove,|Halifax Dartmouth,|Fredericton,|Moncton,|Cape Breton Regional Municipality,|Canada,)' \
  fixtures/raw-trend.csv >> fixtures/trend-oct-2026.real.csv
```

**Locations included (verbatim from PHAC file):**
- Toronto (City, pruid=35)
- Ontario (Province, pruid=35)
- Halifax (City, pruid=12)
- Halifax Halifax, Halifax Millcove, Halifax Dartmouth (Sites, pruid=12)
- Fredericton (Site, pruid=13)
- Moncton (Site, pruid=13)
- Cape Breton Regional Municipality (City, pruid=12)
- Canada (national)

---

## aggregate-oct-2026.real.csv

| Field | Value |
|---|---|
| Source URL | https://health-infobase.canada.ca/src/data/wastewater/wastewater_aggregate.csv |
| Retrieved | 2026-10-31 |
| Full download saved as | `fixtures/raw-aggregate.csv` (gitignored — 63 k rows) |

**How it was built:**

```
curl -sL <URL> -o fixtures/raw-aggregate.csv
head -1 fixtures/raw-aggregate.csv > fixtures/aggregate-oct-2026.real.csv
grep "^Toronto," fixtures/raw-aggregate.csv | tail -20 >> fixtures/aggregate-oct-2026.real.csv
grep "^Halifax," fixtures/raw-aggregate.csv | tail -16 >> fixtures/aggregate-oct-2026.real.csv
```

**Rows included:** last 20 Toronto rows (EpiWeeks 38–42, 2026) + last 16 Halifax rows (EpiWeeks 39–42, 2026).

---

## Synthetic fixtures

Any file with `synthetic` in its filename contains constructed data (not from PHAC).
These are used only for edge-case tests where the exact values don't matter.
