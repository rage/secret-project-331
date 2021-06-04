import { BlockConfiguration } from "@wordpress/blocks"
import ExercisesInPartEditor from "./ExercisesInPartEditor"
import ExercisesInPartSave from "./ExercisesInPartSave"

export interface ExercisesInPartAttributes {
  hidden: boolean
}

const ExercisesInPartConfiguration: BlockConfiguration<ExercisesInPartAttributes> = {
  title: "Exercises In Part",
  description: "Exercises In Part",
  category: "embed",
  attributes: {
    hidden: {
      type: "boolean",
      default: false,
    },
  },
  edit: ExercisesInPartEditor,
  save: ExercisesInPartSave,
}

export default ExercisesInPartConfiguration
