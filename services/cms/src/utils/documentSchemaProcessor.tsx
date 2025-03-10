/* eslint-disable i18next/no-literal-string */

import { BlockInstance } from "@wordpress/blocks"
import { v4, v5 } from "uuid"

import { ExerciseAttributes } from "../blocks/Exercise"
import { ExerciseSlideAttributes } from "../blocks/Exercise/ExerciseSlide/ExerciseSlideEditor"
import { ExerciseTaskAttributes } from "../blocks/Exercise/ExerciseTask/ExerciseTaskEditor"

import {
  CmsPageExercise,
  CmsPageExerciseSlide,
  CmsPageExerciseTask,
  CmsPageUpdate,
  CmsPeerOrSelfReviewConfig,
} from "@/shared-module/common/bindings"

/**
 * Only id is allowed in normalized exercises. This is because:
 * 1. We save the other attributes (and inner blocks) in the backend to other tables (exercises, exercise_slides, exercise_tasks) instead of pages.content_json
 * 2. When we render the page in the course material we don't include sensitive attributes in the content like the private_spec
 * 3. When renderingn the exercise in course material we only need the exercise id the fetch what we need
 */
interface NormalizedExerciseBlockAttributes {
  id: string
}

export interface UnnormalizedDocument {
  content: BlockInstance[]
  title: string
  urlPath: string
  chapterId: string | null
}

/**
 * Prepares blocks for sending to the backend.
 * Removes innerblocks and all attributes except id from moocfi/exercise
 * These get removed because while they're needed when editing the exercise with
 * the Gutenberg editor, we cannot send them to users when they're viewing
 * the pages.
 *
 * The function denormalizeDocument reverses this e.g. `denormalizeDocument(normalizeDocument(doc)) === doc`
 */
export function normalizeDocument(args: UnnormalizedDocument): CmsPageUpdate {
  const exercises: CmsPageExercise[] = []
  const exerciseSlides: CmsPageExerciseSlide[] = []
  const exerciseTasks: CmsPageExerciseTask[] = []

  let exerciseCount = 0

  const normalizedBlocks = args.content.map((block) => {
    if (block.name !== "moocfi/exercise") {
      return block
    }
    const originalExerciseBlock = block as BlockInstance<ExerciseAttributes>
    const exerciseAttributes = block.attributes as ExerciseAttributes
    const peerOrSelfReviewConfig =
      exerciseAttributes.peer_or_self_review_config === "null" ||
      exerciseAttributes.peer_or_self_review_config === null
        ? null
        : (JSON.parse(exerciseAttributes.peer_or_self_review_config) as CmsPeerOrSelfReviewConfig)

    const execiseSettingsBlock = block.innerBlocks.find(
      (block2) => block2.name === "moocfi/exercise-settings",
    )
    if (execiseSettingsBlock === undefined) {
      throw new Error(
        "Exercise block is missing the settings block. It should not be possible to remove that one.",
      )
    }
    if (peerOrSelfReviewConfig) {
      peerOrSelfReviewConfig.review_instructions = execiseSettingsBlock.innerBlocks
    }

    exercises.push({
      id: exerciseAttributes.id,
      name: exerciseAttributes.name,
      order_number: exerciseCount,
      score_maximum: exerciseAttributes.score_maximum,
      max_tries_per_slide: exerciseAttributes.max_tries_per_slide ?? null,
      limit_number_of_tries: exerciseAttributes.limit_number_of_tries,
      deadline: null,
      needs_peer_review: exerciseAttributes.needs_peer_review,
      needs_self_review: exerciseAttributes.needs_self_review,
      peer_or_self_review_config: peerOrSelfReviewConfig,
      peer_or_self_review_questions:
        exerciseAttributes.peer_or_self_review_questions_config === "null" ||
        exerciseAttributes.peer_or_self_review_config === null
          ? null
          : JSON.parse(exerciseAttributes.peer_or_self_review_questions_config),
      use_course_default_peer_or_self_review_config:
        exerciseAttributes.use_course_default_peer_review,
    })
    exerciseCount = exerciseCount + 1
    let exerciseSlideCount = 0
    const slidesBlock = block.innerBlocks.find((block2) => block2.name === "moocfi/exercise-slides")
    if (slidesBlock === undefined) {
      throw new Error(
        "Exercise block is missing slides. It should not be possible to remove that one.",
      )
    }
    slidesBlock.innerBlocks.forEach((block2) => {
      if (block2.name !== "moocfi/exercise-slide") {
        return
      }
      exerciseSlides.push({
        id: block2.attributes.id,
        exercise_id: exerciseAttributes.id,
        order_number: exerciseSlideCount,
      })
      exerciseSlideCount = exerciseSlideCount + 1
      let exerciseTaskCount = 0
      block2.innerBlocks.forEach((block3) => {
        if (block3.name !== "moocfi/exercise-task") {
          return
        }
        exerciseTasks.push({
          id: block3.attributes.id,
          assignment: block3.innerBlocks,
          exercise_slide_id: block2.attributes.id,
          exercise_type: block3.attributes.exercise_type,
          private_spec: JSON.parse(block3.attributes.private_spec),
          order_number: exerciseTaskCount,
        })
        exerciseTaskCount = exerciseTaskCount + 1
      })
    })
    const newBlock: BlockInstance<NormalizedExerciseBlockAttributes> = {
      clientId: originalExerciseBlock.clientId,
      isValid: originalExerciseBlock.isValid,
      name: originalExerciseBlock.name,
      // Important omissions
      innerBlocks: [],
      attributes: { id: originalExerciseBlock.attributes.id },
    }
    return newBlock
  })

  // Verify exercise blocks don't have other attributes than id
  const exerciseBlocks = normalizedBlocks.filter((block) => block.name === "moocfi/exercise")
  exerciseBlocks.forEach((block) => {
    const attributes = block.attributes
    if (Object.prototype.hasOwnProperty.call(attributes, "id") === false) {
      throw new Error("Exercise block is missing id attribute")
    }
    if (Object.keys(attributes).length !== 1) {
      throw new Error(
        `Exercise block has more attributes than just id. This is not allowed. Found attributes: ${JSON.stringify(attributes)}`,
      )
    }
  })

  return {
    content: normalizedBlocks,
    chapter_id: args.chapterId,
    exercises,
    exercise_slides: exerciseSlides,
    exercise_tasks: exerciseTasks,
    title: args.title,
    url_path: args.urlPath,
  }
}

/**
 * Converts backend-normalized page data to nested Gutenberg blocks.
 *
 * The function `normalizeDocument` reverses this. e.g `normalizeDocument(denormalizeDocument(doc)) === doc`
 */
export function denormalizeDocument(input: CmsPageUpdate): UnnormalizedDocument {
  const contentBlocks = (input.content as BlockInstance[]).map((block) => {
    if (block.name !== "moocfi/exercise") {
      return block
    }

    const exercise = input.exercises.find((x) => x.id === block.attributes.id)
    if (!exercise) {
      return block
    }

    const normalizedBlock = block as BlockInstance<NormalizedExerciseBlockAttributes>

    const slides = input.exercise_slides.filter((x) => x.exercise_id === exercise.id)
    const slidesInnerBlocks = slides.map((slide) => {
      const tasks = input.exercise_tasks.filter((x) => x.exercise_slide_id === slide.id)
      const denormalizedSlide: BlockInstance<ExerciseSlideAttributes> = {
        // Using slide id in tests ensures that this operation is reversible
        clientId: process.env.NODE_ENV === "test" ? slide.id : v4(),
        name: "moocfi/exercise-slide",
        attributes: {
          id: slide.id,
          order_number: slide.order_number,
        },
        isValid: true,
        innerBlocks: tasks
          .sort((a, b) => a.order_number - b.order_number)
          .map((task) => {
            const denormalizedTask: BlockInstance<ExerciseTaskAttributes> = {
              // Using task id in tests ensures that this operation is reversible
              clientId: process.env.NODE_ENV === "test" ? task.id : v4(),
              name: "moocfi/exercise-task",
              attributes: {
                id: task.id,
                exercise_type: task.exercise_type,
                private_spec: JSON.stringify(task.private_spec),
                show_editor: false,
                order_number: task.order_number,
              },
              isValid: true,
              innerBlocks: (task.assignment ?? []) as BlockInstance[],
            }
            return denormalizedTask
          }),
      }
      return denormalizedSlide
    })

    const settingsInnerBlocks =
      (exercise.peer_or_self_review_config?.review_instructions as BlockInstance[]) ?? []

    const exerciseBlock: BlockInstance<ExerciseAttributes> = {
      ...normalizedBlock,
      innerBlocks: [
        {
          name: "moocfi/exercise-settings",
          isValid: true,
          // Deterministic client id but derived from exercise id so that it's different for each exercise
          clientId: v5("9ab7c78a-4b3a-4695-bca1-cb93de0dabec", exercise.id),
          attributes: {},
          innerBlocks: settingsInnerBlocks,
        },
        {
          name: "moocfi/exercise-slides",
          isValid: true,
          // Deterministic client id but derived from exercise id so that it's different for each exercise
          clientId: v5("335f1f8e-4fd3-4a5f-888f-87efd6ef4595", exercise.id),
          attributes: {},
          innerBlocks: slidesInnerBlocks,
        },
      ],
      attributes: {
        id: normalizedBlock.attributes.id,
        name: exercise.name,
        score_maximum: exercise.score_maximum,
        max_tries_per_slide: exercise.max_tries_per_slide ?? undefined,
        limit_number_of_tries: exercise.limit_number_of_tries,
        needs_peer_review: exercise.needs_peer_review,
        needs_self_review: exercise.needs_self_review,
        peer_or_self_review_config:
          (exercise.needs_peer_review || exercise.needs_self_review) &&
          !exercise.use_course_default_peer_or_self_review_config
            ? JSON.stringify(exercise.peer_or_self_review_config)
            : "null",
        peer_or_self_review_questions_config:
          (exercise.needs_peer_review || exercise.needs_self_review) &&
          !exercise.use_course_default_peer_or_self_review_config
            ? JSON.stringify(exercise.peer_or_self_review_questions)
            : "null",
        use_course_default_peer_review: exercise.use_course_default_peer_or_self_review_config,
      },
    }

    return exerciseBlock
  })

  const res: UnnormalizedDocument = {
    content: contentBlocks,
    title: input.title,
    urlPath: input.url_path,
    chapterId: input.chapter_id,
  }

  return res
}
