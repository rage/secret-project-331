/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration, BlockEditProps } from "@wordpress/blocks"
import { ComponentType, useEffect } from "react"
import { v4 } from "uuid"

import { MOOCFI_CATEGORY_SLUG } from "../../utils/Gutenberg/modifyGutenbergCategories"

import ExerciseEditor from "./ExerciseEditor"
import ExerciseSave from "./ExerciseSave"

export interface ExerciseAttributes {
  id: string
  name: string
  score_maximum: number
  max_tries_per_slide?: number
  limit_number_of_tries: boolean
  needs_peer_review: boolean
  peer_review_config: string
  peer_review_questions_config: string
}

const ExerciseConfiguration: BlockConfiguration<ExerciseAttributes> = {
  title: "Exercise",
  description: "Exercise",
  // Enforce exercise can't be InnerBlock - https://github.com/WordPress/gutenberg/issues/7845
  parent: ["core/post-content"],
  category: MOOCFI_CATEGORY_SLUG,
  attributes: {
    id: {
      type: "string",
      default: undefined,
    },
    name: {
      type: "string",
      default: "",
    },
    score_maximum: {
      type: "number",
      default: 1,
    },
    max_tries_per_slide: {
      type: "number",
      default: undefined,
    },
    limit_number_of_tries: {
      type: "boolean",
      default: false,
    },
    needs_peer_review: {
      type: "boolean",
      default: false,
    },
    peer_review_config: {
      type: "string",
      default: "[]",
    },
    peer_review_questions_config: {
      type: "string",
      default: "[]",
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

export default ExerciseConfiguration
