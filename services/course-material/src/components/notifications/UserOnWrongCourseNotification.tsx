import Link from "next/link"
import React from "react"
import { useQuery } from "react-query"

import { fetchCourseById } from "../../services/backend"
import Banner from "../../shared-module/components/Banner/Banner"
import GenericLoading from "../GenericLoading"

export interface UserOnWrongCourseNotificationProps {
  correctCourseId: string
}

const UserOnWrongCourseNotification: React.FC<UserOnWrongCourseNotificationProps> = ({
  correctCourseId,
}) => {
  const { isLoading, error, data } = useQuery(`correct-course-${correctCourseId}`, () =>
    fetchCourseById(correctCourseId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <Banner variant="readOnly">
      <>
        Looks like you&apos;re already on a different language version of this course. Before
        answering any exercises, please return to{" "}
        <Link passHref href={{ pathname: "/[courseSlug]", query: { courseSlug: data.slug } }}>
          {data.name}
        </Link>{" "}
        or change your active language in the settings.
      </>
    </Banner>
  )
}

export default UserOnWrongCourseNotification
