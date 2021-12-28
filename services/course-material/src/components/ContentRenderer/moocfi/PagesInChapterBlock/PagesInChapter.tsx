import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchChaptersPagesExcludeFrontpage } from "../../../../services/backend"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import PagesInChapterBox from "../../../../shared-module/components/PagesInChapterBox"
import Spinner from "../../../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
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
      <div className={normalWidthCenteredComponentStyles}>
        <div
          className={css`
            padding: 7.5em 1em;
          `}
        >
          <h2
            className={css`
              font-size: 1.25rem;
              text-align: center;
              color: #505050;
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
              {getPagesInChapterExcludeFrontpage.data.map((page) => (
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
