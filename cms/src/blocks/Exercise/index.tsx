import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import ExerciseEditor from "./ExerciseEditor"
import ExerciseSave from "./ExerciseSave"
import { v4 } from "uuid"
import { ComponentType } from "react"

export interface ExerciseAttributes {
  exercise_id: string
}

const ExerciseConfiguration: BlockConfiguration<ExerciseAttributes> = {
  title: "Exercise",
  description: "Exercise",
  category: "embed",
  attributes: {
    exercise_id: {
      type: "string",
      default: null,
    },
  },
  edit: enforceExerciseIdDefined(ExerciseEditor),
  save: ExerciseSave,
}

/**
 * Wrapper to set attributes.exercise_id before rendering
 * @param WrappedComponent
 */
function enforceExerciseIdDefined(
  WrappedComponent: ComponentType<BlockEditProps<ExerciseAttributes>>,
): ComponentType<BlockEditProps<ExerciseAttributes>> {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"
  const InnerComponent = (props: BlockEditProps<ExerciseAttributes>) => {
    if (!props.attributes.exercise_id) {
      const id = v4()
      props.setAttributes({ exercise_id: id })
      return null
    }
    return <WrappedComponent {...props} />
  }

  InnerComponent.displayName = displayName
  return InnerComponent
}

export default ExerciseConfiguration
