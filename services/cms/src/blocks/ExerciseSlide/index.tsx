import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import React, { ComponentType, useContext, useEffect } from "react"
import { v4 } from "uuid"

import { PageDispatch } from "../../contexts/PageContext"

import ExerciseSlideEditor, { ExerciseSlideAttributes } from "./ExerciseSlideEditor"
import ExerciseSlideSave from "./ExerciseSlideSave"

const ExerciseSlideConfiguration: BlockConfiguration<ExerciseSlideAttributes> = {
  title: "ExerciseSlide",
  description: "An exercise slide",
  category: "embed",
  parent: ["moocfi/exercise"],
  attributes: {
    id: {
      type: "string",
      default: undefined,
    },
  },
  edit: enforceExerciseSlideIdDefined(ExerciseSlideEditor),
  save: ExerciseSlideSave,
}

/**
 * Wrapper to set attributes.exercise_id before rendering
 * @param WrappedComponent
 */
function enforceExerciseSlideIdDefined(
  WrappedComponent: ComponentType<BlockEditProps<ExerciseSlideAttributes>>,
): ComponentType<BlockEditProps<ExerciseSlideAttributes>> {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"
  const InnerComponent = (props: BlockEditProps<ExerciseSlideAttributes>) => {
    const { attributes, setAttributes } = props
    const dispatch = useContext(PageDispatch)

    useEffect(() => {
      if (!attributes.id) {
        const id = v4()
        dispatch({ type: "addExerciseSlide", payload: { id, order_number: 0 } })
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

export default ExerciseSlideConfiguration
