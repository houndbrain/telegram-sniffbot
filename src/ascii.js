/**
 * The same hound the web interface uses, so both surfaces carry one mark.
 */
export const HOUND = String.raw`          / \__
         (    @\___
         /         O
        /   (_____/
       /_____/   U`;

/**
 * Renders a receptor fingerprint as a compact block.
 *
 * The web draws all 971 slots; a phone cannot. This samples the bank evenly and
 * maps each sample to one of four densities, so the shape of the pattern
 * survives even though the resolution does not. The caption always states how
 * many slots are actually active, so the picture is never mistaken for a count.
 */
const RAMP = ["·", "▒", "▓", "█"];

export function receptorBlock(values, { columns = 24, rows = 5 } = {}) {
  if (!Array.isArray(values) || !values.length) return "";
  const cells = columns * rows;
  const step = values.length / cells;
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    let line = "";
    for (let c = 0; c < columns; c += 1) {
      const index = Math.min(values.length - 1, Math.floor((r * columns + c) * step));
      const v = Number(values[index]) || 0;
      line += RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(v * RAMP.length)))];
    }
    out.push(line);
  }
  return out.join("\n");
}

/** A small horizontal bar, used for share-of-supply and similar ratios. */
export function bar(ratio, width = 10) {
  const filled = Math.max(0, Math.min(width, Math.round((Number(ratio) || 0) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}
