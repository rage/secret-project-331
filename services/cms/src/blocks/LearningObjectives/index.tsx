"use client"

/* oxlint-disable i18next/no-literal-string */
import { createBlock } from "@wordpress/blocks"

import type { BlockConfiguration, BlockInstance } from "@/utils/Gutenberg/types"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"
import LearningObjectiveSectionEditor from "./LearningObjectiveSectionEditor"
import LearningObjectiveSectionSave from "./LearningObjectiveSectionSave"

const LearningObjectiveSectionConfiguration: BlockConfiguration = {
  title: "Learning Objective Section",
  description:
    "Learning Objective section where you describe what you will learn in this chapter/page.",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {},
  edit: LearningObjectiveSectionEditor,
  save: LearningObjectiveSectionSave,
  transforms: {
    from: [
      {
        type: "block",
        blocks: ["core/list"],
        // oxlint-disable-next-line typescript/no-explicit-any
        transform(attributes: any, innerBlocks: any) {
          return createBlock("moocfi/learning-objectives", {}, [
            createBlock("core/list", attributes, innerBlocks),
          ])
        },
      },
    ],
    to: [
      {
        type: "block",
        blocks: ["core/list"],
        transform(_attributes: unknown, innerBlocks: unknown) {
          // safe: transform is only invoked when the list block has at least one inner block
          return (innerBlocks as BlockInstance[])[0] as BlockInstance
        },
      },
    ],
  },
}

export default LearningObjectiveSectionConfiguration
