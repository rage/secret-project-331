import { createAction } from "typesafe-actions"
import { v4 } from "uuid"

export const addedTimelineItemAction = createAction(
  "ADDED_TIMELINE_ITEM",
  (quizItemId: string, year: string, correctEvent: string) => ({
    quizItemId,
    year,
    correctEvent,
    timelineItemId: v4(),
  }),
)<{ quizItemId: string; year: string; correctEvent: string; timelineItemId: string }>()
