/**
 * Checkout-only presentation filter over the city master list — NOT a
 * data transformation. `cities.txt`, the shipping-rate resolver, and
 * `cofeo/v1/shipping-cities`'s underlying data are all untouched by
 * this; it only decides what the Checkout city selector *shows*.
 * 330 master entries in, 301 customer-facing entries out.
 *
 * Two explicit, non-generic exclusion lists (Phase 8 sign-off) —
 * never fuzzy matching, never applied to the master data itself:
 *
 * 1. Operational/internal entries — not customer-facing cities at
 *    all: every "Point de relais..." delivery relay/pickup point
 *    (prefix match, 11 entries), plus 5 exact non-city entries.
 *
 * 2. Duplicate/spelling-variant entries — 13 pairs, each collapsed
 *    to a single surviving label (itself one of the two original
 *    raw strings, never a synthesized name). The excluded member of
 *    each pair is listed below with the surviving spelling it maps
 *    to, for auditability. Two lower-confidence pairs (Mzouda/
 *    Mzoudia, Idalsan/Idelsane) were deliberately left un-collapsed
 *    — both members still show, per the sign-off.
 */
const POINT_DE_RELAIS_PREFIX = "Point de relais";

const OPERATIONAL_EXCLUDES = new Set(["Autres", "BureauAM", "BureauAMF", "Cafemort", "INTERNATIONAL"]);

// excluded label -> surviving label it duplicates
const DUPLICATE_EXCLUDES: Record<string, string> = {
  Afourer1: "Afourer",
  "bni ansar": "Beni Ansar",
  boujnibaa: "Boujniba",
  "Boulmane Dades": "Boumalne Dadès",
  Echemmaia: "Chemaia",
  "Kalaat M'Gouna": "Kelâat M'Gouna",
  midelt: "Midelt",
  "Oulad taima": "Ouled Teima",
  Outatlhaj: "Outat El Haj",
  Sale: "Salé",
  Sekoura: "Skoura",
  Talsinnt: "Talsint",
  Tamesluht: "Tameslouhte",
};

export function filterCheckoutCities(cities: string[]): string[] {
  return cities.filter(
    (city) =>
      !city.startsWith(POINT_DE_RELAIS_PREFIX) &&
      !OPERATIONAL_EXCLUDES.has(city) &&
      !(city in DUPLICATE_EXCLUDES),
  );
}
