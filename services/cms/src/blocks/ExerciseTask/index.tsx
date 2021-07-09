import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import { ComponentType } from "react"
import { v4 } from "uuid"

import ExerciseTaskEditor from "./ExerciseTaskEditor"
import ExerciseTaskSave from "./ExerciseTaskSave"

export interface ExerciseTaskAttributes {
  id: string
  exercise_type: string
  public_spec: string
  private_spec: string
}

const ExerciseTaskConfiguration: BlockConfiguration<ExerciseTaskAttributes> = {
  title: "ExerciseTask",
  description: "An exercise task",
  category: "embed",
  parent: ["moocfi/exercise"],
  attributes: {
    id: {
      type: "string",
      default: null,
    },
    exercise_type: {
      type: "string",
      default: null,
    },
    public_spec: {
      type: "string",
      default: null,
    },
    private_spec: {
      type: "string",
      default: null,
    },
  },
  edit: enforceExerciseTaskIdDefined(ExerciseTaskEditor),
  save: ExerciseTaskSave,
}

/**
 * Wrapper to set attributes.exercise_id before rendering
 * @param WrappedComponent
 */
function enforceExerciseTaskIdDefined(
  WrappedComponent: ComponentType<BlockEditProps<ExerciseTaskAttributes>>,
): ComponentType<BlockEditProps<ExerciseTaskAttributes>> {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"
  const InnerComponent = (props: BlockEditProps<ExerciseTaskAttributes>) => {
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

export default ExerciseTaskConfiguration
