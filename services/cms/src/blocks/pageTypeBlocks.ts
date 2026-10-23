/* oxlint-disable i18next/no-literal-string */

import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { blockTypeMapForFrontPages, blockTypeMapForPages, blockTypeMapForTopLevelPages } from "."
import { supportedCoreBlocks } from "./supportedGutenbergBlocks"

/** Course page kinds whose editors offer different blocks. */
export const PAGE_TYPES = [
  "course-page",
  "chapter-front-page",
  "top-level-page",
  "course-front-page",
] as const

export type PageType = (typeof PAGE_TYPES)[number]

/** Course settings that add blocks to chapter pages. */
export interface CourseBlockFeatures {
  chapterLockingEnabled: boolean
  canAddChatbot: boolean
}

/** Blocks a chapter page offers only when the course enables the feature. */
export const COURSE_FEATURE_GATED_BLOCKS: Record<string, keyof CourseBlockFeatures> = {
  "moocfi/lock-chapter": "chapterLockingEnabled",
  "moocfi/chatbot": "canAddChatbot",
}

/**
 * The page type of a page in the CMS. Exam pages edit like chapter pages, and a chapter's front page
 * can't be told apart from its other pages here; both get the same blocks.
 */
export const pageTypeOfPage = (
  chapterId: string | null,
  examId: string | null,
  urlPath: string,
): PageType => {
  if (chapterId !== null || examId !== null) {
    return "course-page"
  }
  return urlPath === "/" ? "course-front-page" : "top-level-page"
}

/** Custom blocks the editor of a page of this type lets a teacher insert. */
export const customBlocksForPageType = (
  pageType: PageType,
  features: CourseBlockFeatures,
  // oxlint-disable-next-line typescript/no-explicit-any
): [string, BlockConfiguration<Record<string, any>>][] => {
  switch (pageType) {
    case "course-page":
    case "chapter-front-page":
      return blockTypeMapForPages.filter(([blockName]) => {
        const feature = COURSE_FEATURE_GATED_BLOCKS[blockName]
        return feature === undefined || features[feature]
      })
    case "course-front-page":
      return blockTypeMapForFrontPages
    case "top-level-page":
      return blockTypeMapForTopLevelPages
  }
}

/** Every block, core and custom, the editor of a page of this type lets a teacher insert. */
export const insertableBlockNames = (
  pageType: PageType,
  features: CourseBlockFeatures,
): string[] => [
  ...supportedCoreBlocks,
  ...customBlocksForPageType(pageType, features).map(([blockName]) => blockName),
]
