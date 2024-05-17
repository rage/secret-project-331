/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import React, { ComponentType, useEffect } from "react"
import { v4 } from "uuid"

import { MOOCFI_CATEGORY_SLUG } from "../../../utils/Gutenberg/modifyGutenbergCategories"

import ExerciseSlideEditor, { ExerciseSlideAttributes } from "./ExerciseSlideEditor"
import ExerciseSlideSave from "./ExerciseSlideSave"

const ExerciseSlideConfiguration: BlockConfiguration<ExerciseSlideAttributes> = {
  title: "ExerciseSlide",
  description: "An exercise slide",
  category: MOOCFI_CATEGORY_SLUG,
  parent: ["moocfi/exercise"],
  attributes: {
    id: {
      type: "string",
      default: undefined,
    },
    order_number: {
      type: "number",
      default: 0,
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
  WrappedComponent: ComponentType<React.PropsWithChildren<BlockEditProps<ExerciseSlideAttributes>>>,
): ComponentType<React.PropsWithChildren<BlockEditProps<ExerciseSlideAttributes>>> {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"
  const InnerComponent = (props: BlockEditProps<ExerciseSlideAttributes>) => {
    const { attributes, setAttributes } = props

    useEffect(() => {
      if (!attributes.id) {
        const id = v4()
        setAttributes({ id })
      }
    }, [attributes.id, setAttributes])

    if (!props.attributes.id) {
      return null
    }

    return <WrappedComponent {...props} />
  }

  InnerComponent.displayName = displayName
  return InnerComponent
}

export default ExerciseSlideConfiguration
