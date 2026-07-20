"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCourseMaterialCoursePages } from "@/generated/course-material-api/sdk.generated"
import { QueryResult } from "@/shared-module/components"
import { coursePageRoute } from "@/utils/course-material/routing"

interface PublicPageListProps {
  courseId: string
  organizationSlug: string
}

const PublicPageList: React.FC<React.PropsWithChildren<PublicPageListProps>> = ({
  courseId,
  organizationSlug,
}) => {
  const { t } = useTranslation()
  const getAllCoursePages = useQuery({
    queryKey: [`course-${courseId}-all-pages`],
    queryFn: () =>
      getCourseMaterialCoursePages({
        path: {
          course_id: courseId,
        },
      }),
  })

  return (
    <QueryResult query={getAllCoursePages} emptyFallback={<p>{t("this-course-has-no-pages")}</p>}>
      {(data) => (
        <>
          <p>{t("heres-a-list-of-all-public-pages-for-this-course")}</p>
          {data.map((page) => {
            return (
              <Link href={coursePageRoute(organizationSlug, courseId, page.url_path)} key={page.id}>
                {page.title}({page.url_path})
              </Link>
            )
          })}
        </>
      )}
    </QueryResult>
  )
}

export default PublicPageList
