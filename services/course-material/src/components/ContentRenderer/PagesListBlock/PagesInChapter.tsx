import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React from "react"
import { useQuery } from "react-query"

import { fetchChaptersPagesExcludeFrontpage } from "../../../services/backend"
import PagesInChapterBox from "../../../shared-module/components/PagesInChapterBox"
import { normalWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import GenericLoading from "../../GenericLoading"

const PagesInChapter: React.FC<{ chapterId: string }> = ({ chapterId }) => {
  const courseSlug = useRouter().query.courseSlug
  const { isLoading, error, data } = useQuery(
    `chapter-${chapterId}-pages-excluding-frontpage`,
    () => fetchChaptersPagesExcludeFrontpage(chapterId),
  )
  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <>
      {data.length > 0 && (
        <div className={normalWidthCenteredComponentStyles}>
          <div
            className={css`
              padding: 5em 1em;
            `}
          >
            <h3
              className={css`
                font-style: normal;
                font-weight: 600;
                font-size: 2em;
                line-height: 2.5em;
                text-align: center;

                color: #505050;
              `}
            >
              TABLE OF CONTENTS
            </h3>

            {data.map((page) => (
              <PagesInChapterBox
                variant="text"
                chapterIndex={page.order_number}
                chapterTitle={page.title}
                selected={false}
                key={page.id}
                id={page.id}
                url={"/courses/" + courseSlug + page.url_path}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
export default PagesInChapter
