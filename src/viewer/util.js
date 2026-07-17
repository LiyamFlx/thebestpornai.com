/* ---- Safe string transport for inline onclick attributes ----
   esc() protects HTML context only; the browser entity-decodes attribute
   values BEFORE the JS engine parses them, so esc'd quotes still break out of
   the JS string literal (XSS via manifest-supplied titles/ids). jsq() URI-
   encodes the value (incl. apostrophes, which encodeURIComponent leaves raw);
   the receiving function decodes with jsdec(). Output is [A-Za-z0-9%.\-_~]
   only — inert in both HTML-attribute and JS-string contexts. */
export const jsq = s => encodeURIComponent(String(s)).replace(/'/g, "%27");
export const jsdec = s => { try { return decodeURIComponent(s); } catch(_) { return String(s); } };
