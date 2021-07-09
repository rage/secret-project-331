import { BlockConfiguration } from "@wordpress/blocks"

import ExercisesInChapterEditor from "./ExercisesInChapterEditor"
import ExercisesInChapterSave from "./ExercisesInChapterSave"

const ExercisesInChapterConfiguration: BlockConfiguration = {
  title: "Exercises In Chapter",
  description: "Exercises In Chapter",
  category: "embed",
  attributes: {},
  edit: ExercisesInChapterEditor,
  save: ExercisesInChapterSave,
}

export default ExercisesInChapterConfiguration
