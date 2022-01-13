import { css } from "@emotion/css"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import CoursePageContext from "../../../../contexts/CoursePageContext"
import Spinner from "../../../../shared-module/components/Spinner"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ChapterGrid from "./ChapterGrid"

const CourseChapterGridBlock: React.FC = () => {
  const { t } = useTranslation()
  const pageContext = useContext(CoursePageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant={"small"} />
  }

  if (pageContext.pageData.course_id === null) {
    return <div>{t("error-page-without-course")}</div>
  }

  return (
    <div
      className={css`
        padding: 4em 0;
      `}
    >
      <ChapterGrid courseId={pageContext.pageData.course_id} />
    </div>
  )
}

export default withErrorBoundary(CourseChapterGridBlock)
