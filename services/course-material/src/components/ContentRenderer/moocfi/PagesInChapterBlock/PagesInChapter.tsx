import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchChaptersPagesExcludeFrontpage } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import PagesInChapterBox from "../../../../shared-module/components/PagesInChapterBox"
import Spinner from "../../../../shared-module/components/Spinner"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "../../../../shared-module/utils/constants"
import { coursePageRoute } from "../../../../utils/routing"

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
  const getPagesInChapterExcludeFrontpage = useQuery(
    [`chapter-${chapterId}-pages-excluding-frontpage`],
    () => fetchChaptersPagesExcludeFrontpage(chapterId),
  )

  return (
    <>
      <div>
        <div
          className={css`
            margin: 4em 0;
          `}
        >
          <h2
            className={cx(
              INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
              css`
                font-size: 2.5rem;
                font-weight: 400;
                text-align: center;
                color: #1a2333;
                margin-bottom: 2rem;
              `,
            )}
          >
            {t("table-of-contents")}
          </h2>
          {getPagesInChapterExcludeFrontpage.isError && (
            <ErrorBanner variant={"readOnly"} error={getPagesInChapterExcludeFrontpage.error} />
          )}
          {(getPagesInChapterExcludeFrontpage.isLoading ||
            getPagesInChapterExcludeFrontpage.isIdle) && <Spinner variant={"medium"} />}
          {getPagesInChapterExcludeFrontpage.isSuccess && (
            <>
              {getPagesInChapterExcludeFrontpage.data
                .sort((a, b) => a.order_number - b.order_number)
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
        </div>
      </div>
    </>
  )
}
export default PagesInChapter
