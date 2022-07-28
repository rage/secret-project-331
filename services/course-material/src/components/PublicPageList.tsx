import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchAllCoursePages } from "../services/backend"
import ErrorBanner from "../shared-module/components/ErrorBanner"
import Spinner from "../shared-module/components/Spinner"
import { coursePageRoute } from "../utils/routing"

interface PublicPageListProps {
  courseId: string
  organizationSlug: string
}

const PublicPageList: React.FC<React.PropsWithChildren<PublicPageListProps>> = ({
  courseId,
  organizationSlug,
}) => {
  const { t } = useTranslation()
  const getAllCoursePages = useQuery([`course-${courseId}-all-pages`], () =>
    fetchAllCoursePages(courseId),
  )

  return (
    <>
      {getAllCoursePages.isError && (
        <ErrorBanner variant={"readOnly"} error={getAllCoursePages.error} />
      )}
      {getAllCoursePages.isLoading && <Spinner variant={"medium"} />}
      {getAllCoursePages.isSuccess && (
        <>
          {getAllCoursePages.data.length === 0 ? (
            <p>{t("this-course-has-no-pages")}</p>
          ) : (
            <>
              <p>{t("heres-a-list-of-all-public-pages-for-this-course")}</p>
              {getAllCoursePages.data.map((page) => {
                return (
                  <Link
                    href={coursePageRoute(organizationSlug, courseId, page.url_path)}
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
          )}
        </>
      )}
    </>
  )
}

export default PublicPageList
