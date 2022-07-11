/* eslint-disable i18next/no-literal-string */

import { BlockInstance } from "@wordpress/blocks"
import { v4 } from "uuid"

import { ExerciseAttributes } from "../blocks/Exercise"
import { ExerciseSlideAttributes } from "../blocks/ExerciseSlide/ExerciseSlideEditor"
import { ExerciseTaskAttributes } from "../blocks/ExerciseTask/ExerciseTaskEditor"
import {
  CmsPageExercise,
  CmsPageExerciseSlide,
  CmsPageExerciseTask,
  CmsPageUpdate,
} from "../shared-module/bindings"

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
    exercises.push({
      id: exerciseAttributes.id,
      name: exerciseAttributes.name,
      order_number: exerciseCount,
      score_maximum: exerciseAttributes.score_maximum,
      max_tries_per_slide: exerciseAttributes.max_tries_per_slide ?? null,
      limit_number_of_tries: exerciseAttributes.limit_number_of_tries,
      deadline: null,
      needs_peer_review: exerciseAttributes.needs_peer_review,
    })
    exerciseCount = exerciseCount + 1
    let exerciseSlideCount = 0
    block.innerBlocks.forEach((block2) => {
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

  return {
    content: normalizedBlocks,
    chapter_id: args.chapterId,
    exercises,
    exercise_slides: exerciseSlides,
    exercise_tasks: exerciseTasks,
    peer_reviews: [],
    peer_review_questions: [],
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
    const innerBlocks = slides.map((slide) => {
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

    const exerciseBlock: BlockInstance<ExerciseAttributes> = {
      ...normalizedBlock,
      innerBlocks,
      attributes: {
        id: normalizedBlock.attributes.id,
        name: exercise.name,
        score_maximum: exercise.score_maximum,
        max_tries_per_slide: exercise.max_tries_per_slide ?? undefined,
        limit_number_of_tries: exercise.limit_number_of_tries,
        needs_peer_review: exercise.needs_peer_review,
        peer_review_config: "",
        peer_review_questions_config: "",
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
