/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import { ComponentType, useEffect } from "react"
import { v4 } from "uuid"

import { MOOCFI_CATEGORY_SLUG } from "../../../utils/Gutenberg/modifyGutenbergCategories"

import ExerciseTaskEditor, { ExerciseTaskAttributes } from "./ExerciseTaskEditor"
import ExerciseTaskSave from "./ExerciseTaskSave"

const ExerciseTaskConfiguration: BlockConfiguration<ExerciseTaskAttributes> = {
  title: "ExerciseTask",
  description: "An exercise task",
  category: MOOCFI_CATEGORY_SLUG,
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
    show_editor: {
      type: "boolean",
      default: false,
    },
    order_number: {
      type: "number",
      default: 0,
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
  WrappedComponent: ComponentType<React.PropsWithChildren<BlockEditProps<ExerciseTaskAttributes>>>,
): ComponentType<React.PropsWithChildren<BlockEditProps<ExerciseTaskAttributes>>> {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component"
  const InnerComponent = (props: BlockEditProps<ExerciseTaskAttributes>) => {
    const { attributes, setAttributes } = props

    useEffect(() => {
      if (!attributes.id) {
        const id = v4()
        setAttributes({ id, private_spec: null })
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

export default ExerciseTaskConfiguration
