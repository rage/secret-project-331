/* eslint-disable i18next/no-literal-string */
// To get a list of all available blocks from Gutenberg, run: npm run list-gutenberg-block-names
export const supportedCoreBlocks: string[] = [
  "core/paragraph",
  "core/image",
  "core/heading",
  "core/list",
  "core/list-item",
  "core/quote",
  "core/audio",
  "core/code",
  "core/buttons",
  "core/button", // Don't remove button even though deprecated, as they are now children of core/buttons
  "core/columns",
  "core/column", // core/column is child of core/columns
  "core/embed", // This is used by youtube, twitter etc.
  "core/file",
  "core/html",
  "core/preformatted",
  "core/pullquote",
  // "core/rss", // TODO
  "core/separator",
  "core/block",
  "core/spacer",
  "core/table",
  "core/verse",
]

export const allowedBlockVariants: Record<string, string[]> = {
  "core/embed": [
    "twitter",
    "youtube",
    // "soundcloud",
    "spotify",
    // "flickr",
    "vimeo",
    // "imgur",
    // "reddit",
    // "slideshare",
    // "ted",
    // "tumblr",
    "mentimeter",
  ],
}

export const allowedEmailCoreBlocks: string[] = [
  "core/paragraph",
  "core/image",
  "core/heading",
  "core/list",
  "core/list-item",
  "core/table",
]

export const allowedExamInstructionsCoreBlocks: string[] = [
  "core/paragraph",
  "core/image",
  "core/heading",
  "core/list",
  "core/list-item",
  "core/table",
]
