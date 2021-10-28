import { BlockInstance } from "@wordpress/blocks"
import { v4 } from "uuid"

import { ExerciseSlideAttributes } from "../blocks/ExerciseSlide/ExerciseSlideEditor"
import { ExerciseTaskAttributes } from "../blocks/ExerciseTask/ExerciseTaskEditor"
import {
  CmsPageUpdate,
  ContentManagementPage,
  Exercise,
  ExerciseSlide,
  ExerciseTask,
} from "../shared-module/bindings"

export function normalizeDocument(
  pageId: string,
  content: BlockInstance[],
  title: string,
  urlPath: string,
  chapterId: string | null,
): CmsPageUpdate {
  const exercises: Exercise[] = []
  const exerciseSlides: ExerciseSlide[] = []
  const exerciseTasks: ExerciseTask[] = []

  // TODO: Use proper types once available, most of this is junk.
  const normalizedBlocks = content.map((block, i1) => {
    if (block.name !== "moocfi/exercise") {
      return block
    }
    exercises.push({
      id: block.attributes.id as string,
      name: block.attributes.name as string,
      // Id required but not actually used... I think
      chapter_id: v4(),
      copied_from: null,
      // Id required but not actually used... I think
      course_id: v4(),
      created_at: new Date(),
      deadline: new Date(),
      deleted_at: null,
      order_number: i1 + 1,
      page_id: pageId,
      score_maximum: 0,
      updated_at: new Date(),
    })
    block.innerBlocks.forEach((block2, i2) => {
      if (block2.name !== "moocfi/exercise-slide") {
        return
      }
      exerciseSlides.push({
        id: block2.attributes.id as string,
        exercise_id: block.attributes.id as string,
        created_at: new Date(),
        deleted_at: null,
        order_number: i2 + 1,
        updated_at: new Date(),
      })
      block2.innerBlocks.forEach((block3) => {
        if (block3.name !== "moocfi/exercise-task") {
          return
        }
        exerciseTasks.push({
          id: block3.attributes.id as string,
          assignment: block3.innerBlocks,
          copied_from: null,
          created_at: new Date(),
          deleted_at: null,
          exercise_slide_id: block2.attributes.id as string,
          exercise_type: block3.attributes.exercise_type as string,
          model_solution_spec: null,
          private_spec: JSON.parse(block3.attributes.private_spec as string),
          public_spec: null,
          spec_file_id: null,
          updated_at: new Date(),
        })
      })
    })
    return { ...block, innerBlocks: [] }
  })

  return {
    content: normalizedBlocks,
    chapter_id: chapterId,
    exercises,
    exercise_slides: exerciseSlides,
    exercise_tasks: exerciseTasks,
    title,
    url_path: urlPath,
  }
}

/**
 * Converts backend-normalized page data to nested Gutenberg blocks.
 */
export function denormalizeDocument(document: ContentManagementPage): BlockInstance[] {
  const contentBlocks = (document.page.content as BlockInstance[]).map((block) => {
    if (block.name !== "moocfi/exercise") {
      return block
    }

    const exercise = document.exercises.find((x) => x.id === block.attributes.id)
    if (!exercise) {
      return block
    }

    const slides = document.exercise_slides.filter((x) => x.exercise_id === exercise.id)
    const innerBlocks = slides.map((slide) => {
      const tasks = document.exercise_tasks.filter((x) => x.exercise_slide_id === slide.id)
      const denormalizedSlide: BlockInstance<ExerciseSlideAttributes> = {
        clientId: v4(),
        name: "moocfi/exercise-slide",
        attributes: {
          id: slide.id,
          order_number: slide.order_number,
        },
        isValid: true,
        innerBlocks: tasks.map((task) => {
          const denormalizedTask: BlockInstance<ExerciseTaskAttributes> = {
            clientId: v4(),
            name: "moocfi/exercise-task",
            attributes: {
              id: task.id,
              exercise_type: task.exercise_type,
              private_spec: JSON.stringify(task.private_spec),
              show_editor: false,
            },
            isValid: true,
            innerBlocks: [],
          }
          return denormalizedTask
        }),
      }
      return denormalizedSlide
    })

    return { ...block, innerBlocks }
  })

  return contentBlocks
}
