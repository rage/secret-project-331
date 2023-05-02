/* eslint-disable i18next/no-literal-string */
import { produce } from "immer"
import { createReducer } from "typesafe-actions"

import { action, NormalizedQuizItemTimelineItem } from "../../../../types/types"
import { initializedEditor } from "../editorActions"

import {
  addedTimelineItemAction,
  deleteTimelineItemEventAction,
  editTimelineItemEventAction,
  editTimelineItemYearAction,
} from "./timelineItemsActions"

export const timelineItemReducer = createReducer<
  { [optionId: string]: NormalizedQuizItemTimelineItem },
  action
>({})
  .handleAction(
    initializedEditor,
    (_state, action) => action.payload.normalizedQuiz.timelineItems ?? {},
  )

  .handleAction(addedTimelineItemAction, (state, action) => {
    return produce(state, (draftState) => {
      draftState[action.payload.timelineItemId] = {
        id: action.payload.timelineItemId,
        year: action.payload.year.trim(),
        correctEventName: action.payload.correctEventName.trim(),
        correctEventId: action.payload.correctEventId,
      }
    })
  })

  .handleAction(editTimelineItemYearAction, (state, action) => {
    return produce(state, (draftState) => {
      const item = draftState[action.payload.timelineItemId]
      item.year = action.payload.newValue
    })
  })

  .handleAction(editTimelineItemEventAction, (state, action) => {
    return produce(state, (draftState) => {
      const item = draftState[action.payload.timelineItemId]
      item.correctEventName = action.payload.newValue
    })
  })

  .handleAction(deleteTimelineItemEventAction, (state, action) => {
    return produce(state, (draftState) => {
      delete draftState[action.payload.timelineItemId]
    })
  })

export default timelineItemReducer
