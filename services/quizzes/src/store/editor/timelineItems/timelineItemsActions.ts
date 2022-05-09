import { createAction } from "typesafe-actions"
import { v4 } from "uuid"

export const addedTimelineItemAction = createAction(
  "ADDED_TIMELINE_ITEM",
  (quizItemId: string, year: string, correctEventName: string) => ({
    quizItemId,
    year,
    correctEventName,
    timelineItemId: v4(),
    correctEventId: v4(),
  }),
)<{
  quizItemId: string
  year: string
  correctEventName: string
  timelineItemId: string
  correctEventId: string
}>()

export const editTimelineItemYearAction = createAction(
  "EDITED_TIMELINE_ITEM_YEAR",
  (timelineItemId: string, newValue: string) => ({
    timelineItemId,
    newValue,
  }),
)<{
  timelineItemId: string
  newValue: string
}>()

export const editTimelineItemEventAction = createAction(
  "EDITED_TIMELINE_ITEM_EVENT",
  (timelineItemId: string, newValue: string) => ({
    timelineItemId,
    newValue,
  }),
)<{
  timelineItemId: string
  newValue: string
}>()

export const deleteTimelineItemEventAction = createAction(
  "DELETED_TIMELINE_ITEM",
  (quizItemId: string, timelineItemId: string) => ({
    timelineItemId,
    quizItemId,
  }),
)<{
  timelineItemId: string
  quizItemId: string
}>()
