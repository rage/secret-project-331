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
    <Banner
      variant="readOnly"
      content={`Looks like you're already doing this course in a different language. Before you can answer any exercises, click here to return to ${data.name} or change your active language in the settings.`}
    />
  )
}

export default UserOnWrongCourseNotification
