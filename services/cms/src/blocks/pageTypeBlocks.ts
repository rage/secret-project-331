import type { BlockConfiguration } from "@/utils/Gutenberg/types"

import { blockTypeMapForFrontPages, blockTypeMapForPages, blockTypeMapForTopLevelPages } from "."
import { COURSE_FEATURE_GATES, type CourseBlockFeatures, type PageType } from "./pageTypes"
import { supportedCoreBlocks } from "./supportedGutenbergBlocks"

/** Custom blocks the editor of a page of this type lets a teacher insert. */
export const customBlocksForPageType = (
  pageType: PageType,
  features: CourseBlockFeatures,
  // oxlint-disable-next-line typescript/no-explicit-any
): [string, BlockConfiguration<Record<string, any>>][] => {
  switch (pageType) {
    case "course-page":
      return blockTypeMapForPages.filter(([blockName]) => {
        const gate = COURSE_FEATURE_GATES[blockName]
        return gate === undefined || features[gate.setting]
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
