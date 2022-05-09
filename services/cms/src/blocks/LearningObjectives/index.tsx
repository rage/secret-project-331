/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import LearningObjectiveSectionEditor from "./LearningObjectiveSectionEditor"
import LearningObjectiveSectionSave from "./LearningObjectiveSectionSave"

export interface LearningObjectiveSectionAttributes {
  title: string
}

const LearningObjectiveSectionConfiguration: BlockConfiguration<LearningObjectiveSectionAttributes> =
  {
    title: "Learning Objective Section",
    description:
      "Learning Objective section where you describe what you will learn in this chapter/page.",
    category: MOOCFI_CATEGORY_SLUG,
    attributes: {
      title: {
        type: "string",
        source: "html",
        selector: "h2",
        default: "What you will learn in this chapter...",
      },
    },
    edit: LearningObjectiveSectionEditor,
    save: LearningObjectiveSectionSave,
  }

export default LearningObjectiveSectionConfiguration
