// Gaia stars and known asteroids for the frame on screen, from /api/context at that frame's date.
//
// Results are cached per date for the current field, so a blinking loop asks once per frame, not every
// time the frame comes round. Requests are NOT cancelled when the frame changes (otherwise a slow
// backend would never finish while playing); they're cancelled when the field changes or on unmount.
import { useEffect, useReducer, useRef } from "react";
import { getContext } from "../../api/api.js";

/**
 * @param {{ra:number, dec:number, fov:number}} field
 * @param {number|undefined} mjd  date of the frame on screen
 * @param {boolean} enabled       false = don't fetch (e.g. both overlays switched off)
 * @returns {{stars: object[], asteroids: object[]}|null}  null until loaded (or if it failed)
 */
export function useFrameContext({ ra, dec, fov }, mjd, enabled) {
  const fieldKey = `${ra}|${dec}|${fov}`;
  const store = useRef({ fieldKey: null, byDate: new Map(), controller: null });
  const [, rerender] = useReducer((n) => n + 1, 0);

  // New field: forget old results and cancel their requests. Declared first so it runs first.
  useEffect(() => {
    const controller = new AbortController();
    store.current = { fieldKey, byDate: new Map(), controller };
    return () => controller.abort();
  }, [fieldKey]);

  useEffect(() => {
    const field = store.current;
    if (!enabled || mjd === undefined || field.fieldKey !== fieldKey || field.byDate.has(mjd)) return;

    field.byDate.set(mjd, null); // requested, not back yet
    getContext({ ra, dec, fov, mjd }, { signal: field.controller.signal })
      .then((context) => {
        if (store.current !== field) return; // field changed meanwhile
        field.byDate.set(mjd, context);
        rerender();
      })
      .catch(() => {
        if (store.current === field) field.byDate.delete(mjd); // try again next time this frame shows
      });
  }, [fieldKey, mjd, enabled, ra, dec, fov]);

  const field = store.current;
  return field.fieldKey === fieldKey ? field.byDate.get(mjd) ?? null : null;
}
