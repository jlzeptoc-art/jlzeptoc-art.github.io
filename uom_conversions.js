/**
 * Unit-of-Measure conversion table for label quantity calculations.
 *
 * Goal:
 * - Provide a SINGLE, editable place to define how many "bottle labels" are needed
 *   for each product (SKU) and unit of measure (UOM).
 * - The schedule page will calculate labels needed ONLY from this table.
 *
 * How it works:
 * - For a given order line: (sku, orderedQty, uom)
 * - labelsNeeded = orderedQty * labelsPerUom
 *
 * Edit instructions (dev):
 * 1) Add/modify entries under `products`.
 * 2) Use the exact SKU shown in the schedule ("SKU#") as the key.
 * 3) For each SKU, define one or more UOM conversions under `uom`.
 *    - Example: { CS: 4 } means 1 case (CS) requires 4 bottle labels.
 *    - Example: { EA: 1 } means 1 each requires 1 bottle label.
 *
 * Notes:
 * - If a SKU/UOM conversion is missing, the UI will show "Missing conversion"
 *   and will not guess from the description.
 */

/* eslint-disable no-unused-vars */
window.MAINTEX_LABEL_UOM_CONVERSIONS = {
  version: 1,

  /**
   * Optional: normalize common unit spellings to schedule UOM codes.
   * The schedule currently uses: CS, EA, PL, DR
   */
  uomAliases: {
    CASE: "CS",
    CASES: "CS",
    CS: "CS",
    EACH: "EA",
    EA: "EA",
    PAIL: "PL",
    PAILS: "PL",
    PL: "PL",
    DRUM: "DR",
    DRUMS: "DR",
    DR: "DR",
  },

  /**
   * Optional defaults by UOM when a SKU-specific value isn't provided.
   * Use this ONLY when it is true for every product of that UOM.
   *
   * Common assumption: pails/drums/each need 1 product label each.
   * If you have exceptions, add SKU-specific overrides in `products`.
   */
  defaultLabelsPerUom: {
    EA: 1,
    PL: 1,
    DR: 1,
    // CS intentionally omitted (varies by product pack count)
  },

  /**
   * SKU-specific conversions.
   *
   * Shape:
   * products: {
   *   "SKU123": {
   *     name: "Optional product name",
   *     uom: { CS: 4, EA: 1 }
   *   }
   * }
   */
  products: {
    // "EXAMPLE-SKU": { name: "Example Product", uom: { CS: 4 } },
  },
};

function _normUom(uomRaw) {
  const t = String(uomRaw ?? "").trim().toUpperCase();
  if (!t) return "";
  const map = window.MAINTEX_LABEL_UOM_CONVERSIONS?.uomAliases || {};
  return map[t] || t;
}

function _normSku(skuRaw) {
  return String(skuRaw ?? "").trim();
}

/**
 * Returns { labelsNeeded, labelsPerUom } or null if unknown/uncomputable.
 */
window.getBottleLabelsNeededFromConversions = function getBottleLabelsNeededFromConversions(
  skuRaw,
  uomRaw,
  qtyRaw
) {
  const sku = _normSku(skuRaw);
  const uom = _normUom(uomRaw);

  if (!sku || !uom) return null;

  const n = typeof qtyRaw === "number" ? qtyRaw : Number(String(qtyRaw).replace(/,/g, "").trim());
  if (!isFinite(n)) return null;

  const table = window.MAINTEX_LABEL_UOM_CONVERSIONS;
  const rec = table?.products?.[sku];

  let labelsPerUom = null;
  if (rec && rec.uom && Object.prototype.hasOwnProperty.call(rec.uom, uom)) {
    labelsPerUom = Number(rec.uom[uom]);
  } else if (table?.defaultLabelsPerUom && Object.prototype.hasOwnProperty.call(table.defaultLabelsPerUom, uom)) {
    labelsPerUom = Number(table.defaultLabelsPerUom[uom]);
  }

  if (!isFinite(labelsPerUom) || labelsPerUom <= 0) return null;

  return {
    labelsPerUom,
    labelsNeeded: n * labelsPerUom,
  };
};

