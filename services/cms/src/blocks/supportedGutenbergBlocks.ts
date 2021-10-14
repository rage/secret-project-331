// To get a list of all available blocks from Gutenberg, run: npm run list-gutenberg-block-names
export const supportedCoreBlocks: string[] = [
  "core/paragraph",
  "core/image",
  "core/heading",
  "core/list",
  "core/quote",
  "core/shortcode",
  "core/audio",
  "core/button",
  "core/buttons",
  "core/code",
  "core/columns",
  "core/column",
  "core/embed", // This is used by youtube, twitter etc.
  "core/file",
  "core/html",
  "core/preformatted",
  "core/pullquote",
  "core/rss",
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
    // "vimeo",
    // "imgur",
    // "reddit",
    // "slideshare",
    // "ted",
    // "tumblr",
  ],
}

export const allowedEmailCoreBlocks: string[] = [
  "core/paragraph",
  "core/image",
  "core/heading",
  "core/list",
  "core/table",
]
