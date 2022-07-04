import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchChaptersPagesExcludeFrontpage } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import PagesInChapterBox from "../../../../shared-module/components/PagesInChapterBox"
import Spinner from "../../../../shared-module/components/Spinner"
import { coursePageRoute } from "../../../../utils/routing"

export interface PagesInChapterProps {
  chapterId: string
  organizationSlug: string
  courseSlug: string
}

const PagesInChapter: React.FC<PagesInChapterProps> = ({
  chapterId,
  courseSlug,
  organizationSlug,
}) => {
  const { t } = useTranslation()
  const getPagesInChapterExcludeFrontpage = useQuery(
    `chapter-${chapterId}-pages-excluding-frontpage`,
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
            className={css`
              font-size: 2.5rem;
              font-weight: 400;
              text-align: center;
              color: #1a2333;
              margin-bottom: 2rem;
            `}
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
