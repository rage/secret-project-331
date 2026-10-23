"use client"

import { useQuery } from "@tanstack/react-query"

import { getAgentChangesetsOptions } from "@/generated/api/@tanstack/react-query.generated"

/** Counts the changes in the user's open AI agent changeset for the course, for the tab badge. */
const createOpenAgentChangeCountHook = (courseId: string) => {
  const useOpenAgentChangeCount = () =>
    useQuery({
      ...getAgentChangesetsOptions({ query: { course_id: courseId } }),
      select: (summaries) =>
        summaries
          .filter((summary) => summary.changeset.status === "open")
          .reduce((count, summary) => count + summary.entities.length, 0),
    })
  return useOpenAgentChangeCount
}

export default createOpenAgentChangeCountHook
