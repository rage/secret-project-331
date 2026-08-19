// To get a list of all available blocks from Gutenberg, run: pnpm run list-gutenberg-block-names
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

/**
 * Core blocks handed to `registerCoreBlocks`. Wider than the allow lists here, because a block type
 * must be registered for stored content to parse into it even when no inserter offers it.
 */
export const coreBlocksToRegister: string[] = [
  ...supportedCoreBlocks,
  // registerCoreBlocks names these as the unregistered-type and grouping handlers no matter which
  // blocks it is asked to register, so they have to exist.
  "core/missing",
  "core/group",
  // moocfi/lock-chapter allows this as a nested block, so stored content can contain it.
  "core/video",
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
    "thinglink",
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

export const allowedPartnerCoreBlocks: string[] = ["core/image"]

export const allowedExamInstructionsCoreBlocks: string[] = [
  "core/paragraph",
  "core/image",
  "core/heading",
  "core/list",
  "core/list-item",
  "core/table",
]

export const allowedResearchFormCoreBlocks: string[] = [
  "core/paragraph",
  "core/heading",
  "core/list",
  "core/list-item",
]
