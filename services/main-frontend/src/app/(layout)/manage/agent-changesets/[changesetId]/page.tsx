"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

import { getAgentChangesetOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseAgentChangesetRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

/** Short review link; forwards to the course-scoped review page. */
function AgentChangesetShortLinkPage() {
  const params = useParams<{ changesetId: string }>()
  const router = useRouter()
  const reviewQuery = useQuery(
    getAgentChangesetOptions({ path: { changeset_id: params.changesetId } }),
  )
  const courseId = reviewQuery.data?.changeset.course_id

  useEffect(() => {
    if (courseId) {
      router.replace(manageCourseAgentChangesetRoute(courseId, params.changesetId))
    }
  }, [courseId, params.changesetId, router])

  return <QueryResult query={reviewQuery}>{() => null}</QueryResult>
}

export default withErrorBoundary(withSignedIn(AgentChangesetShortLinkPage))
