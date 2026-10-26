// Whole-word sounds people make while thinking; "umbrella" and "error" are not touched.
const FILLER = /(?:^|\s)(?:um+|uh+|uhm+|erm?|hmm+|mm+|ah+)(?=[\s,.]|$)[,.]?/gi

/** Speech turned into text keeps the "um"s and "uh"s; the entry parser reads cleaner without them. */
export function cleanSpoken(heard: string): string {
  return heard
    .replaceAll(FILLER, ' ')
    .replaceAll(/\s+,/g, ',')
    .replaceAll(/,\s*,/g, ',')
    .replaceAll(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
}
