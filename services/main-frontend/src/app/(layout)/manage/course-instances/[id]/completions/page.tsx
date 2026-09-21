"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import React, { useEffect } from "react"

import { getCourseInstanceOptions } from "@/generated/api/@tanstack/react-query.generated"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseStudentsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import { INSTANCE_PARAM } from "../../../courses/[id]/students/StudentsContext"

const COMPLETIONS_TAB = "completions"

/**
 * Sends the instance's completions to the course roster, narrowed to this instance.
 *
 * There is one roster for a course's completions and it is the Students tab: a second one over the
 * same students, with its own filters, exports and summary, could only drift away from it.
 */
const CourseInstanceCompletionsRedirect: React.FC = () => {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const courseInstanceId = params.id
  const courseInstanceQuery = useQuery(
    getCourseInstanceOptions({ path: { course_instance_id: courseInstanceId } }),
  )
  const courseId = courseInstanceQuery.data?.course_id

  useEffect(() => {
    if (!courseId) {
      return
    }
    const query = new URLSearchParams({ [INSTANCE_PARAM]: courseInstanceId })
    router.replace(`${manageCourseStudentsRoute(courseId)}/${COMPLETIONS_TAB}?${query.toString()}`)
  }, [courseId, courseInstanceId, router])

  return <Spinner variant="medium" />
}

export default withErrorBoundary(withSignedIn(CourseInstanceCompletionsRedirect))
