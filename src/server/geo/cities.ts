/**
 * ING-11: Canadian city gazetteer.
 *
 * Maps well-known Canadian city slugs to province name and Statistics Canada pruid.
 * Used to resolve cities that have no PHAC monitoring site to their province aggregate.
 *
 * Sources:
 *   - Province pruids: Statistics Canada SGC / PHAC trend CSV (verified 2026-10-31)
 *   - City-province assignments: standard Canadian geography
 *
 * This is NOT a coverage claim. It only provides province affiliation for
 * routing a no-site city to the correct PHAC provincial aggregate row.
 * Never substitute another city's values.
 */

export interface GazetteerCity {
  /** Slug form of the city name (matches slugify() output) */
  slug: string;
  /** Display name */
  cityName: string;
  /** Province display name — matches PHAC province row `province` field */
  province: string;
  /** Statistics Canada Standard Geographical Classification code (pruid) */
  pruid: string;
}

/**
 * Province pruids verified from PHAC trend CSV Province rows (2026-10-31).
 */
const PROVINCE_PRUIDS: Record<string, string> = {
  "Newfoundland and Labrador": "10",
  "Prince Edward Island": "11",
  "Nova Scotia": "12",
  "New Brunswick": "13",
  Quebec: "24",
  Ontario: "35",
  Manitoba: "46",
  Saskatchewan: "47",
  Alberta: "48",
  "British Columbia": "59",
  Yukon: "60",
};

function entry(
  slug: string,
  cityName: string,
  province: string
): GazetteerCity {
  return {
    slug,
    cityName,
    province,
    pruid: PROVINCE_PRUIDS[province] ?? "",
  };
}

/**
 * Gazetteer of Canadian cities.
 * Includes all cities present in PHAC trend data + common cities with no PHAC site.
 *
 * Map key is the slug (output of slugify()).
 */
export const GAZETTEER: ReadonlyMap<string, GazetteerCity> = new Map([
  // --- Cities present in PHAC trend data (city or site grouping) ---
  ["toronto", entry("toronto", "Toronto", "Ontario")],
  ["halifax", entry("halifax", "Halifax", "Nova Scotia")],
  ["halifax-halifax", entry("halifax-halifax", "Halifax Halifax", "Nova Scotia")],
  ["halifax-millcove", entry("halifax-millcove", "Halifax Millcove", "Nova Scotia")],
  ["halifax-dartmouth", entry("halifax-dartmouth", "Halifax Dartmouth", "Nova Scotia")],
  ["fredericton", entry("fredericton", "Fredericton", "New Brunswick")],
  ["moncton", entry("moncton", "Moncton", "New Brunswick")],
  ["cape-breton-regional-municipality", entry("cape-breton-regional-municipality", "Cape Breton Regional Municipality", "Nova Scotia")],
  // Additional PHAC city sites that may appear in the full live file
  ["edmonton", entry("edmonton", "Edmonton", "Alberta")],
  ["calgary", entry("calgary", "Calgary", "Alberta")],
  ["winnipeg", entry("winnipeg", "Winnipeg", "Manitoba")],
  ["saskatoon", entry("saskatoon", "Saskatoon", "Saskatchewan")],
  ["regina", entry("regina", "Regina", "Saskatchewan")],
  ["vancouver", entry("vancouver", "Vancouver", "British Columbia")],
  ["victoria", entry("victoria", "Victoria", "British Columbia")],
  ["kelowna", entry("kelowna", "Kelowna", "British Columbia")],
  ["prince-george", entry("prince-george", "Prince George", "British Columbia")],
  ["abbotsford", entry("abbotsford", "Abbotsford", "British Columbia")],
  ["montreal", entry("montreal", "Montreal", "Quebec")],
  ["quebec-city", entry("quebec-city", "Quebec City", "Quebec")],
  ["saguenay", entry("saguenay", "Saguenay", "Quebec")],
  ["sherbrooke", entry("sherbrooke", "Sherbrooke", "Quebec")],
  ["trois-rivieres", entry("trois-rivieres", "Trois-Rivières", "Quebec")],
  ["thunder-bay", entry("thunder-bay", "Thunder Bay", "Ontario")],
  ["london", entry("london", "London", "Ontario")],
  ["hamilton", entry("hamilton", "Hamilton", "Ontario")],
  ["kingston", entry("kingston", "Kingston", "Ontario")],
  ["sudbury", entry("sudbury", "Sudbury", "Ontario")],
  ["peel-region", entry("peel-region", "Peel Region", "Ontario")],
  ["peterborough", entry("peterborough", "Peterborough", "Ontario")],
  ["saint-john", entry("saint-john", "Saint John", "New Brunswick")],
  ["charlottetown", entry("charlottetown", "Charlottetown", "Prince Edward Island")],
  ["st-john-s", entry("st-john-s", "St. John's", "Newfoundland and Labrador")],
  ["whitehorse", entry("whitehorse", "Whitehorse", "Yukon")],
  // --- Common cities with no PHAC monitoring site (ING-11 requirement) ---
  ["ottawa", entry("ottawa", "Ottawa", "Ontario")],
  ["mississauga", entry("mississauga", "Mississauga", "Ontario")],
  ["brampton", entry("brampton", "Brampton", "Ontario")],
  ["laval", entry("laval", "Laval", "Quebec")],
  ["gatineau", entry("gatineau", "Gatineau", "Quebec")],
  ["surrey", entry("surrey", "Surrey", "British Columbia")],
]);

/**
 * Look up a city by its slug. Returns null if not in the gazetteer.
 */
export function lookupCity(slug: string): GazetteerCity | null {
  return GAZETTEER.get(slug) ?? null;
}
