import React from "react"
import { useQuery } from "react-query"
import { fetchAllCoursePages } from "../services/backend"
import GenericLoading from "./GenericLoading"
import Link from "next/link"

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
      {data.map((page) => {
        let urlWithoutSlash = page.url_path
        if (urlWithoutSlash.indexOf("/") === 0) {
          urlWithoutSlash = urlWithoutSlash.substring(1, urlWithoutSlash.length)
        }
        return (
          <Link
            href={{
              pathname: "/courses/[courseId]/[...path]",
              query: { courseId, path: urlWithoutSlash },
            }}
            key={page.id}
          >
            <a>
              {page.title} ({page.url_path})
            </a>
          </Link>
        )
      })}
    </>
  )
}

export default PublicPageList
