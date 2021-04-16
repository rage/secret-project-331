import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import ExerciseItemEditor from "./ExerciseItemEditor"
import ExerciseItemSave from "./ExerciseItemSave"
import { v4 } from "uuid"
import { ComponentType } from "react"

export interface ExerciseItemAttributes {
  exercise_item_id: string
  spec: any,
}

const ExerciseItemConfiguration: BlockConfiguration<ExerciseItemAttributes> = {
  title: "ExerciseItem",
  description: "An exercise item",
  category: "embed",
  attributes: {
    exercise_item_id: {
      type: "string",
      default: null,
    },
    spec: {
      type: "array",
      default: []
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
    if (!props.attributes.exercise_item_id) {
      const id = v4()
      props.setAttributes({ exercise_item_id: id })
      return null
    }
    return <WrappedComponent {...props} />
  }

  InnerComponent.displayName = displayName
  return InnerComponent
}

export default ExerciseItemConfiguration
