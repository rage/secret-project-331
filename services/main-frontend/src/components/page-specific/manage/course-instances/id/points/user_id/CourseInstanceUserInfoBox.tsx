import React from "react"
import { useTranslation } from "react-i18next"

import KeyValueCard from "../../../../../../KeyValueCard"

import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import { useUserDetails } from "@/hooks/useUserDetails"

interface CourseInstanceUserInfoBoxProps {
  courseId: string
  courseInstanceId: string
  userId: string
}

const CourseInstanceUserInfoBox: React.FC<CourseInstanceUserInfoBoxProps> = ({
  courseId,
  courseInstanceId,
  userId,
}) => {
  const { t } = useTranslation()
  const courseQuery = useCourseQuery(courseId)
  const courseInstancesQuery = useCourseInstancesQuery(courseId)
  const userDetailsQuery = useUserDetails(courseId, userId)

  if (courseQuery.isError || courseInstancesQuery.isError || userDetailsQuery.isError) {
    return null
  }

  if (
    courseQuery.isLoading ||
    courseInstancesQuery.isLoading ||
    userDetailsQuery.isLoading ||
    !courseQuery.data ||
    !courseInstancesQuery.data ||
    !userDetailsQuery.data
  ) {
    return null
  }

  const courseInstance = courseInstancesQuery.data.find(
    (instance) => instance.id === courseInstanceId,
  )

  const items = [
    {
      // eslint-disable-next-line i18next/no-literal-string
      key: "course",
      label: t("label-course-name"),
      value: courseQuery.data.name,
      colSpan: 4,
    },
    ...(courseInstance
      ? [
          {
            // eslint-disable-next-line i18next/no-literal-string
            key: "instance",
            label: t("course-instance"),
            value: courseInstance.name || t("default-instance"),
            colSpan: 4,
          },
        ]
      : []),
    {
      // eslint-disable-next-line i18next/no-literal-string
      key: "first-name",
      label: t("first-name"),
      value: userDetailsQuery.data.first_name,
      colSpan: 2,
    },
    {
      // eslint-disable-next-line i18next/no-literal-string
      key: "last-name",
      label: t("last-name"),
      value: userDetailsQuery.data.last_name,
      colSpan: 2,
    },
    {
      // eslint-disable-next-line i18next/no-literal-string
      key: "email",
      label: t("label-email"),
      value: userDetailsQuery.data.email,
      colSpan: 4,
    },
  ]

  return (
    <KeyValueCard
      sections={[
        {
          title: t("user-information"),
          items,
          gridColumns: 8,
        },
      ]}
    />
  )
}

export default CourseInstanceUserInfoBox
