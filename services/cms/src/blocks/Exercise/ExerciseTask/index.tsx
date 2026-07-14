"use client"

/* oxlint-disable i18next/no-literal-string */
import type { ComponentType } from "react"
import { useEffect } from "react"
import { v4 } from "uuid"

import { MOOCFI_CATEGORY_SLUG } from "../../../utils/Gutenberg/modifyGutenbergCategories"

import type { ExerciseTaskAttributes } from "./ExerciseTaskEditor"
import ExerciseTaskEditor from "./ExerciseTaskEditor"
import ExerciseTaskSave from "./ExerciseTaskSave"

import type { BlockConfiguration, BlockEditProps } from "@/utils/Gutenberg/types"

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

const DEFAULT_DISPLAY_NAME = "Component"

/**
 * Wrapper to set attributes.exercise_id before rendering
 * @param WrappedComponent
 */
function enforceExerciseTaskIdDefined(
  WrappedComponent: ComponentType<React.PropsWithChildren<BlockEditProps<ExerciseTaskAttributes>>>,
): ComponentType<React.PropsWithChildren<BlockEditProps<ExerciseTaskAttributes>>> {
  // Name to display in React Dev tools
  const displayName = WrappedComponent.displayName || WrappedComponent.name || DEFAULT_DISPLAY_NAME
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures WrappedComponent from enclosing scope
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
