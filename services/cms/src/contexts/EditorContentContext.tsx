"use client"

/* oxlint-disable i18next/no-literal-string */

import { produce } from "immer"
import type { Dispatch } from "react"
import React from "react"
import { v4 } from "uuid"

import type { BlockInstance } from "@/utils/Gutenberg/types"

import type { ExerciseSlideAttributes } from "../blocks/Exercise/ExerciseSlide/ExerciseSlideEditor"
import type { ExerciseTaskAttributes } from "../blocks/Exercise/ExerciseTask/ExerciseTaskEditor"

// Context

const EditorContentContext = React.createContext<BlockInstance[]>([])

export default EditorContentContext

// Actions

interface AddExerciseSlideAction {
  type: "addExerciseSlide"
  payload: { clientId: string }
}

interface AddExerciseTaskAction {
  type: "addExerciseTask"
  payload: { clientId: string }
}

interface DeleteExerciseTaskAction {
  type: "deleteExerciseTask"
  payload: { clientId: string }
}

interface SetContentAction {
  type: "setContent"
  payload: BlockInstance[]
}

export type EditorContentAction =
  | AddExerciseSlideAction
  | AddExerciseTaskAction
  | DeleteExerciseTaskAction
  | SetContentAction

// Reducer

export const editorContentReducer = (
  prev: BlockInstance[],
  action: EditorContentAction,
): BlockInstance[] => {
  switch (action.type) {
    case "addExerciseSlide":
      return produce(prev, (draft) => {
        const exerciseBlockIndex = draft.findIndex(
          (block) => block.clientId === action.payload.clientId,
        )
        if (exerciseBlockIndex !== -1) {
          // exerciseBlockIndex !== -1 means the element exists
          const exerciseBlock = draft[exerciseBlockIndex]
          if (!exerciseBlock) {
            return
          }
          const slidesBlock = findExeciseSlidesBlock(exerciseBlock)
          if (!slidesBlock) {
            throw new Error("Exercise block does not have slides block")
          }
          const newSlide: BlockInstance<ExerciseSlideAttributes> = {
            clientId: v4(),
            name: "moocfi/exercise-slide",
            isValid: true,
            attributes: {
              id: v4(),
              order_number: slidesBlock.innerBlocks.length,
            },
            innerBlocks: [],
          }
          slidesBlock.innerBlocks.push(newSlide)
        }
      })
    case "addExerciseTask":
      return produce(prev, (draft) => {
        const exerciseBlockIndex = draft.findIndex((block) => {
          if (block.name !== "moocfi/exercise") {
            return false
          }
          const slidesBlock = findExeciseSlidesBlock(block)
          if (!slidesBlock) {
            return false
          }
          return slidesBlock.innerBlocks.some((x) => x.clientId === action.payload.clientId)
        })
        if (exerciseBlockIndex !== -1) {
          // exerciseBlockIndex !== -1 means the element exists
          const exerciseBlock = draft[exerciseBlockIndex]
          if (!exerciseBlock) {
            return
          }
          const slidesBlock = findExeciseSlidesBlock(exerciseBlock)
          if (!slidesBlock) {
            throw new Error("Exercise block does not have slides block")
          }
          const slide = slidesBlock.innerBlocks.find((x) => x.clientId === action.payload.clientId)
          if (!slide) {
            return
          }

          const newTask: BlockInstance<ExerciseTaskAttributes> = {
            clientId: v4(),
            name: "moocfi/exercise-task",
            isValid: true,
            attributes: {
              id: v4(),
              exercise_type: "",
              private_spec: null,
              show_editor: false,
              order_number: 0,
            },
            innerBlocks: [],
          }

          const slideIndex = slidesBlock.innerBlocks.findIndex((x) => x.clientId === slide.clientId)
          if (slideIndex !== -1) {
            // slideIndex !== -1 means the element exists
            const targetSlide = slidesBlock.innerBlocks[slideIndex]
            if (targetSlide) {
              targetSlide.innerBlocks.push(newTask)
            }
          }
        }
      })
    case "deleteExerciseTask":
      return produce(prev, (draft) => {
        outerloop: for (const block of draft) {
          if (block.name !== "moocfi/exercise") {
            continue
          }
          const slidesBlock = findExeciseSlidesBlock(block)
          if (!slidesBlock) {
            continue
          }
          for (const slideBlock of slidesBlock.innerBlocks) {
            const taskToDeleteIndex = slideBlock.innerBlocks.findIndex(
              (taskBlock) => taskBlock.clientId === action.payload.clientId,
            )
            if (taskToDeleteIndex !== -1) {
              slideBlock.innerBlocks.splice(taskToDeleteIndex, 1)
              break outerloop
            }
          }
        }
      })
    case "setContent":
      return action.payload
  }
}

function findExeciseSlidesBlock(block: BlockInstance): BlockInstance | undefined {
  return block.innerBlocks.find((x) => x.name === "moocfi/exercise-slides")
}

// Dispatch

export const EditorContentDispatch = React.createContext<Dispatch<EditorContentAction>>(() => {
  throw new Error("EditorContentDispatch called outside provider.")
})
