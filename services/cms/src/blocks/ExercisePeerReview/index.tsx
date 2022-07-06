/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import ExercisePeerReviewEditor from "./ExercisePeerReviewEditor"
import ExercisePeerReviewSave from "./ExercisePeerReviewSave"

const ExercisePeerReview: BlockConfiguration = {
  title: "Exercise peer review",
  description: "Exercise peer review",
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    id: {
      type: "string",
      default: undefined,
    },
    order_number: {
      type: "number",
      default: 0,
    },
  },
  edit: ExercisePeerReviewEditor,
  save: ExercisePeerReviewSave,
}

export default ExercisePeerReview
