/** Anchor id of the city list (skip-map link target). Kept out of CanadaMap so the list never pulls the map chunk. */
export const CITY_LIST_ID = "city-list";

/** Resource-cache keys of the four landing reads; shared by the island (early start) and LandingView (consumer). */
export const LANDING_KEYS = {
  locations: "landing:locations",
  observations: "landing:observations",
  dataStatus: "landing:data-status",
  snapshots: "landing:snapshots",
} as const;
