"use client"

import { useQuery } from "@tanstack/react-query"

import { getAgentChangesetCountsOptions } from "@/generated/api/@tanstack/react-query.generated"

/** Counts the changes in the user's open AI agent changeset for the course, for the tab badge. */
const createOpenAgentChangeCountHook = (courseId: string) => {
  const useOpenAgentChangeCount = () =>
    useQuery({
      ...getAgentChangesetCountsOptions({ query: { course_id: courseId } }),
      select: (counts) => counts.open_entity_count,
    })
  return useOpenAgentChangeCount
}

export default createOpenAgentChangeCountHook
