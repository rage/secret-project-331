/**
 * Replace every run of line breaks with a single space, so a single-line field can't hold
 * newlines (pasted multi-line text becomes one line). Tabs and spaces are preserved.
 */
export const toSingleLine = (value: string): string => value.replaceAll(/[\r\n]+/g, " ")
