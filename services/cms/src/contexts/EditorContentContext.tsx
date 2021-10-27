import { BlockInstance } from "@wordpress/blocks"
import React, { Dispatch } from "react"
import { v4 } from "uuid"

// Context

const EditorContentContext = React.createContext<BlockInstance[]>([])

export default EditorContentContext

// Actions

interface AddExerciseSlideAction {
  type: "addExerciseSlide"
  payload: { clientId: string }
}

interface SetContentAction {
  type: "setContent"
  payload: BlockInstance[]
}

export type EditorContentAction = AddExerciseSlideAction | SetContentAction

// Reducer

export const editorContentReducer = (
  prev: BlockInstance[],
  action: EditorContentAction,
): BlockInstance[] => {
  switch (action.type) {
    case "setContent":
      return action.payload as BlockInstance[]
    case "addExerciseSlide": {
      const newSlide: BlockInstance = {
        clientId: v4(),
        name: "moocfi/exercise-slide",
        isValid: true,
        attributes: {
          id: v4(),
        },
        innerBlocks: [],
      }
      return prev.map((x) =>
        x.clientId !== action.payload.clientId
          ? x
          : {
              ...x,
              innerBlocks: x.innerBlocks.concat(newSlide),
            },
      )
    }
  }
}

// Dispatch

export const EditorContentDispatch = React.createContext<Dispatch<EditorContentAction>>(() => {
  throw new Error("EditorContentDispatch called outside provider.")
})
