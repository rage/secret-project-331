/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration, createBlock } from "@wordpress/blocks"

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
        // @ts-expect-error: Transform example from documentation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // @ts-expect-error: Transform example from documentation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transform(_attributes: any, innerBlocks: any[]) {
          return innerBlocks[0]
        },
      },
    ],
  },
}

export default LearningObjectiveSectionConfiguration
