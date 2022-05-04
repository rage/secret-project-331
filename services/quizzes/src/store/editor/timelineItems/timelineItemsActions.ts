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
