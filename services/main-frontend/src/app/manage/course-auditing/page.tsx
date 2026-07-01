"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import CourseAuditingContainer from "./CourseAuditingContainer"
import CourseAuditingUpdateModal from "./CourseAuditingUpdateModal"

import {
  getCoursesForAuditingOptions,
  updateCourseAfterAuditingMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CourseToAuditUpdate } from "@/generated/api/types.generated"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { QueryResult } from "@/shared-module/components"

// TODO: can save and prepare for backend ??

const CourseAuditing = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [course, setCourse] = useState<CourseToAuditUpdate>({
    description: "",
    uh_course_code: "",
  })

  const getCoursesForAuditing = useQuery(getCoursesForAuditingOptions())

  const sortedCoursesForAuditing = useMemo(
    () => [...(getCoursesForAuditing.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [getCoursesForAuditing.data],
  )

  //console.log(sortedCoursesForAuditing[0]?.id)

  //TODO: add error handling
  const updateCourseMutation = useToastMutationOptions(
    updateCourseAfterAuditingMutation(),
    { notify: true, method: "PUT" },
    {
      onSuccess: async (result) => {
        await getCoursesForAuditing.refetch()
        handleClose()
        resetCourse()
      },
    },
  )

  const resetCourse = () => {
    setCourse({
      description: "",
      uh_course_code: "",
    })
  }

  const onChangeCreationModal = (key: string) => (value: string) => {
    setCourse({
      ...course,
      [key]: value,
    })
  }

  const handleClose = () => {
    setOpen(false)
  }
  const renderCourseAuditing = () => (
    <>
      <CourseAuditingContainer
        coursesForAuditing={sortedCoursesForAuditing}
        refetch={getCoursesForAuditing.refetch}
      />
      <CourseAuditingUpdateModal
        open={open}
        handleClose={handleClose}
        course={course}
        onChange={onChangeCreationModal}
        handleSubmit={async () => {
          await updateCourseMutation.mutateAsync({
            body: course,
          })
        }}
      />
    </>
  )
  return (
    <div>
      <h1>{t("title-course-auditing")}</h1>
      <QueryResult query={getCoursesForAuditing} treatEmptyAsData>
        {() => renderCourseAuditing()}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(CourseAuditing)))
