import React from "react"
import { useQuery } from "react-query"
import { fetchAllCoursePages } from "../services/backend"
import GenericLoading from "./GenericLoading"

interface PublicPageListProps {
  courseId: string
}

const PublicPageList: React.FC<PublicPageListProps> = ({ courseId }) => {
  const { isLoading, error, data } = useQuery(`course-${courseId}-all-pages`, () =>
    fetchAllCoursePages(courseId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  if (data.length === 0) {
    return <p>This course has no pages.</p>
  }
  return (
    <>
      <p>Here`&apos;s a list of all public pages for this course:</p>
      <pre>{JSON.stringify(data, undefined, 2)}</pre>
    </>
  )
}

export default PublicPageList
