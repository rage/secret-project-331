/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../../utils/Gutenberg/modifyGutenbergCategories"

import ExerciseSlidesEditor from "./ExerciseSlidesEditor"
import ExerciseSlidesSave from "./ExerciseSlidesSave"

const ExerciseSlidesConfiguration: BlockConfiguration<Record<string, never>> = {
  title: "ExerciseSlides",
  description:
    "Wrapper block for exercise slides, enables to use InnerBlock in multiple places within the exercise block.",
  category: MOOCFI_CATEGORY_SLUG,
  parent: ["moocfi/exercise"],
  attributes: {},
  edit: ExerciseSlidesEditor,
  save: ExerciseSlidesSave,
}

export default ExerciseSlidesConfiguration
