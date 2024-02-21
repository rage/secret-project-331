import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import ExerciseCustomViewEditor from "./ExerciseCustomViewEditor"
import ExerciseCustomViewkSave from "./ExerciseCustomViewSave"

export interface ExerciseCustomViewAttributes {
  exercise_type: string | undefined
  exercise_iframe_url: string | undefined
}

const ExerciseCustomViewBlockConfiguration: BlockConfiguration<ExerciseCustomViewAttributes> = {
  title: "ExerciseCustomViewBlock",
  description: "ExerciseCustomView block",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    exercise_type: {
      type: "string",
      default: undefined,
    },
    exercise_iframe_url: {
      type: "string",
      default: undefined,
    },
  },
  edit: ExerciseCustomViewEditor,
  save: ExerciseCustomViewkSave,
}

export default ExerciseCustomViewBlockConfiguration
