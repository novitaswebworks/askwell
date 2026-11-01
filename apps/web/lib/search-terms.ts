// Keywords for the full-text half of hybrid search. The database turns
// "cape or town" into an OR query, so a chunk that names any of the words is a
// candidate. Only letters and digits get through, so the text is always safe to
// pass on.

const STOP_WORDS = new Set(
  (
    "the and for with about from you your yours our ours his her its their them they this that these those " +
    "are was were been being have has had does did can could would should will shall may might must not " +
    "what which who whom whose how when where why tell give show please there here than then also any some " +
    "get got let lets just very much many more most such into onto over under out off yes"
  ).split(" "),
);

const MAX_KEYWORDS = 12;

export function keywordQuery(text: string): string {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const unique = [...new Set(words.filter((w) => !STOP_WORDS.has(w)))];
  return unique.slice(0, MAX_KEYWORDS).join(" or ");
}
