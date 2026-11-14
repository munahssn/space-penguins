// The same sky position in other tools, so users can check what we found.

const SEARCH_RADIUS_ARCSEC = 10;

/** @returns {{name: string, url: string, what: string}[]} */
export function externalLinks({ ra, dec }) {
  const position = { ra: ra.toFixed(6), dec: dec.toFixed(6) };

  return [
    {
      name: "SIMBAD",
      what: "Known objects at this position",
      url: `https://simbad.cds.unistra.fr/simbad/sim-coo?${new URLSearchParams({
        Coord: `${position.ra} ${position.dec}`,
        Radius: String(SEARCH_RADIUS_ARCSEC),
        "Radius.unit": "arcsec",
      })}`,
    },
    {
      name: "WiseView",
      what: "The same spot in WISE images (2010 onwards)",
      // WiseView reads its settings from the URL hash, not the query string.
      url: `https://byw.tools/wiseview#ra=${position.ra}&dec=${position.dec}&size=176&band=3&speed=500`,
    },
    {
      name: "Legacy Survey",
      what: "Deep optical images",
      url: `https://www.legacysurvey.org/viewer?${new URLSearchParams({ ...position, zoom: "15" })}`,
    },
  ];
}
