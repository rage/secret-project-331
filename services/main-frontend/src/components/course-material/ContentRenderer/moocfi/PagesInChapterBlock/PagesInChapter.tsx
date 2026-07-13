"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCourseMaterialChapterPagesExcludingFrontPage } from "@/generated/course-material-api/sdk.generated"
import PagesInChapterBox from "@/shared-module/common/components/PagesInChapterBox"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "@/shared-module/common/utils/constants"
import { QueryResult } from "@/shared-module/components"
import { coursePageRoute } from "@/utils/course-material/routing"

export interface PagesInChapterProps {
  chapterId: string
  organizationSlug: string
  courseSlug: string
}

const PagesInChapter: React.FC<React.PropsWithChildren<PagesInChapterProps>> = ({
  chapterId,
  courseSlug,
  organizationSlug,
}) => {
  const { t } = useTranslation()
  const getPagesInChapterExcludeFrontpage = useQuery({
    queryKey: [`chapter-${chapterId}-pages-excluding-frontpage`],
    queryFn: () =>
      getCourseMaterialChapterPagesExcludingFrontPage({
        path: {
          chapter_id: chapterId,
        },
      }),
  })

  return (
    <>
      <div>
        <div
          data-testid="pages-in-chapter-container"
          className={css`
            margin: 2.5em 0;
          `}
        >
          <h2
            className={cx(
              INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
              css`
                font-size: 1.5rem;
                font-weight: 500;
                text-align: center;
                color: #1a2333;
                margin-bottom: 1.6rem;

                ${respondToOrLarger.md} {
                  font-size: 1.875rem;
                }
              `,
            )}
          >
            {t("table-of-contents")}
          </h2>
          <QueryResult query={getPagesInChapterExcludeFrontpage}>
            {(data) => (
              <>
                {[...data]
                  .toSorted((a, b) => a.order_number - b.order_number)
                  .map((page) => (
                    <PagesInChapterBox
                      variant="text"
                      chapterIndex={page.order_number}
                      chapterTitle={page.title}
                      selected={false}
                      key={page.id}
                      id={page.id}
                      url={coursePageRoute(organizationSlug, courseSlug, page.url_path)}
                    />
                  ))}
              </>
            )}
          </QueryResult>
        </div>
      </div>
    </>
  )
}
export default PagesInChapter
