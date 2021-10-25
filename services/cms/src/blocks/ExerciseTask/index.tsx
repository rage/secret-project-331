import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import { ComponentType, useContext, useEffect } from "react"
import { v4 } from "uuid"

import { PageDispatch, SimpleExerciseTask } from "../../contexts/PageContext"

import ExerciseTaskEditor, { ExerciseTaskAttributes } from "./ExerciseTaskEditor"
import ExerciseTaskSave from "./ExerciseTaskSave"

const ExerciseTaskConfiguration: BlockConfiguration<ExerciseTaskAttributes> = {
  title: "ExerciseTask",
  description: "An exercise task",
  category: "embed",
  parent: ["moocfi/exercise-slide"],
  attributes: {
    id: {
      type: "string",
      default: undefined,
    },
    exercise_type: {
      type: "string",
      default: undefined,
    },
    private_spec: {
      type: "string",
      default: undefined,
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
    const { attributes, setAttributes } = props
    const dispatch = useContext(PageDispatch)

    useEffect(() => {
      if (!attributes.id) {
        const id = v4()
        const task: SimpleExerciseTask = {
          exercise_type: "",
          id,
          order_number: 0,
          private_spec: null,
        }
        dispatch({ type: "addExerciseTask", payload: task })
        setAttributes({ id, private_spec: null })
      }
    }, [attributes.id, setAttributes, dispatch])

    if (!props.attributes.id) {
      return null
    }

    return <WrappedComponent {...props} />
  }

  InnerComponent.displayName = displayName
  return InnerComponent
}

export default ExerciseTaskConfiguration
