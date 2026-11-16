/**
 * Compares only the primary subtag, so `en-US` material reads as English to an `en` reader. Splits
 * on `_` too, for mooc.fi's `fi_FI`.
 *
 * A reader whose language is not yet known counts as a different one: naming the language the
 * course is in costs a reader who did not need it far less than withholding it from one who did.
 */
export const sameLanguage = (courseLanguage: string, readerLanguage: string | undefined): boolean =>
  readerLanguage !== undefined &&
  courseLanguage.split(/[_-]/)[0] === readerLanguage.split(/[_-]/)[0]
