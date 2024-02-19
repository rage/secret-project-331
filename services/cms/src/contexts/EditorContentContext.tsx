/* eslint-disable i18next/no-literal-string */

import { BlockInstance } from "@wordpress/blocks"
import React, { Dispatch } from "react"
import { v4 } from "uuid"

import { ExerciseSlideAttributes } from "../blocks/Exercise/ExerciseSlide/ExerciseSlideEditor"
import { ExerciseTaskAttributes } from "../blocks/Exercise/ExerciseTask/ExerciseTaskEditor"

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
      return prev.map((block) => {
        if (block.clientId !== action.payload.clientId) {
          return block
        }

        const newSlide: BlockInstance<ExerciseSlideAttributes> = {
          clientId: v4(),
          name: "moocfi/exercise-slide",
          isValid: true,
          attributes: {
            id: v4(),
            order_number: block.innerBlocks.length,
          },
          innerBlocks: [],
        }

        return { ...block, innerBlocks: block.innerBlocks.concat(newSlide) }
      })
    case "addExerciseTask":
      return prev.map((block) => {
        const slide = block.innerBlocks.find((x) => x.clientId === action.payload.clientId)
        if (!slide) {
          return block
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
        const innerBlocks = block.innerBlocks.map((x) =>
          x !== slide ? x : { ...x, innerBlocks: x.innerBlocks.concat(newTask) },
        )

        return { ...block, innerBlocks }
      })
    case "deleteExerciseTask":
      return prev.map((block) => {
        const slide = block.innerBlocks.find((x) =>
          x.innerBlocks.some((y) => y.clientId === action.payload.clientId),
        )
        if (!slide) {
          return block
        }

        const innerBlocks = block.innerBlocks.map((x) =>
          x !== slide
            ? x
            : {
                ...x,
                innerBlocks: x.innerBlocks.filter((y) => y.clientId !== action.payload.clientId),
              },
        )

        return { ...block, innerBlocks }
      })
    case "setContent":
      return action.payload
  }
}

// Dispatch

export const EditorContentDispatch = React.createContext<Dispatch<EditorContentAction>>(() => {
  throw new Error("EditorContentDispatch called outside provider.")
})
