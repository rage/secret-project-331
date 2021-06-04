import { BlockConfiguration } from "@wordpress/blocks"
import ExercisesInPartEditor from "./ExercisesInPartEditor"
import ExercisesInPartSave from "./ExercisesInPartSave"

const ExercisesInPartConfiguration: BlockConfiguration = {
  title: "Exercises In Part",
  description: "Exercises In Part",
  category: "embed",
  edit: ExercisesInPartEditor,
  save: ExercisesInPartSave,
}

export default ExercisesInPartConfiguration
