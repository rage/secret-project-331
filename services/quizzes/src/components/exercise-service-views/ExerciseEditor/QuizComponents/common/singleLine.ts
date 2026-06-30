/**
 * Collapse a value to a single line by replacing every run of line breaks with a single
 * space. Used to keep a collapsed (single-line) field behaving like a native `<input>`,
 * which cannot contain line breaks: pasted multi-line text becomes one line.
 *
 * Runs of consecutive breaks (including mixed `\r\n` / `\r` / `\n`) collapse to one space so
 * words never get glued together. Other whitespace (tabs, existing spaces) is preserved.
 */
export const toSingleLine = (value: string): string => value.replace(/[\r\n]+/g, " ")
