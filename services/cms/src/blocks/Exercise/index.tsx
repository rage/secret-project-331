import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import { ComponentType, useContext, useEffect } from "react"
import { v4 } from "uuid"

import { PageDispatch } from "../../contexts/PageContext"

import ExerciseEditor from "./ExerciseEditor"
import ExerciseSave from "./ExerciseSave"

export interface ExerciseAttributes {
  id: string
  name: string
}

const ExerciseConfiguration: BlockConfiguration<ExerciseAttributes> = {
  title: "Exercise",
  description: "Exercise",
  // Enforce exercise can't be InnerBlock - https://github.com/WordPress/gutenberg/issues/7845
  parent: ["core/post-content"],
  category: "embed",
  attributes: {
    id: {
      type: "string",
      default: undefined,
    },
    name: {
      type: "string",
      default: "",
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
    const { attributes, setAttributes } = props
    const dispatch = useContext(PageDispatch)

    useEffect(() => {
      if (!attributes.id) {
        const id = v4()
        dispatch({ type: "addExercise", payload: { id, name: "" } })
        setAttributes({ id })
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

export default ExerciseConfiguration
