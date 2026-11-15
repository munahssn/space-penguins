// Well-known objects to suggest while typing, on top of the popular finds: nearby stars and brown dwarfs
// that move fast across the sky, and stars that change brightness. Names are standard ones the backend's
// name lookup (/api/resolve → Sesame) understands. No positions here: picking one looks the name up.

export const KNOWN_OBJECTS = [
  { name: "Proxima Centauri", note: "nearest star, moves 3.9″/yr" },
  { name: "Kapteyn's Star", note: "fast-moving star, 8.6″/yr" },
  { name: "Groombridge 1830", note: "fast-moving star, 7.1″/yr" },
  { name: "Lacaille 9352", note: "fast-moving star, 6.9″/yr" },
  { name: "61 Cygni", note: "fast-moving double star, 5.2″/yr" },
  { name: "Lalande 21185", note: "fast-moving star, 4.8″/yr" },
  { name: "Wolf 359", note: "nearby red dwarf, 4.7″/yr" },
  { name: "Van Maanen 2", note: "nearby white dwarf, 3.0″/yr" },
  { name: "Luhman 16", note: "nearest brown dwarf pair, 2.8″/yr" },
  { name: "Teegarden's Star", note: "nearby red dwarf, 5.1″/yr" },
  { name: "Ross 128", note: "nearby red dwarf, 1.4″/yr" },
  { name: "Mira", note: "variable star, brightens and fades over ~11 months" },
  { name: "Chi Cygni", note: "variable star, ~13-month cycle" },
  { name: "R Leonis", note: "variable star, ~10-month cycle" },
  { name: "Algol", note: "eclipsing star, dims every 2.9 days" },
  { name: "Betelgeuse", note: "red supergiant that varies in brightness" },
];
