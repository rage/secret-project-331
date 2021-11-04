import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchAllCoursePages } from "../services/backend"

import GenericLoading from "./GenericLoading"

interface PublicPageListProps {
  courseId: string
}

const PublicPageList: React.FC<PublicPageListProps> = ({ courseId }) => {
  const { t } = useTranslation()
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
    return <p>{t("this-course-has-no-pages")}</p>
  }

  return (
    <>
      <p>{t("heres-a-list-of-all-public-pages-for-this-course")}</p>
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
            passHref
          >
            <a href="replace">
              {page.title} ({page.url_path})
            </a>
          </Link>
        )
      })}
    </>
  )
}

export default PublicPageList
