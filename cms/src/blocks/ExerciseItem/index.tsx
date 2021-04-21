import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import ExerciseItemEditor from "./ExerciseItemEditor"
import ExerciseItemSave from "./ExerciseItemSave"
import { v4 } from "uuid"
import { ComponentType } from "react"

export interface ExerciseItemAttributes {
  id: string
  exercise_type: string
  spec: string
}

const ExerciseItemConfiguration: BlockConfiguration<ExerciseItemAttributes> = {
  title: "ExerciseItem",
  description: "An exercise item",
  category: "embed",
  attributes: {
    id: {
      type: "string",
      default: null,
    },
    exercise_type: {
      type: "string",
      default: null,
    },
    spec: {
      type: "string",
      default: null
    }
  },
  edit: enforceExerciseItemIdDefined(ExerciseItemEditor),
  save: ExerciseItemSave,
}

/**
 * Wrapper to set attributes.exercise_id before rendering
 * @param WrappedComponent
 */
function enforceExerciseItemIdDefined(
  WrappedComponent: ComponentType<BlockEditProps<ExerciseItemAttributes>>,
): ComponentType<BlockEditProps<ExerciseItemAttributes>> {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"
  const InnerComponent = (props: BlockEditProps<ExerciseItemAttributes>) => {
    if (!props.attributes.id) {
      const id = v4()
      props.setAttributes({ id: id })
      return null
    }
    return <WrappedComponent {...props} />
  }

  InnerComponent.displayName = displayName
  return InnerComponent
}

export default ExerciseItemConfiguration
