import { css } from "@emotion/css"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../../../contexts/PageContext"
import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import Spinner from "../../../../shared-module/components/Spinner"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ChapterGrid from "./ChapterGrid"

const CourseChapterGridBlock: React.FC = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant={"small"} />
  }

  if (pageContext.pageData.course_id === null) {
    return <div>{t("error-page-without-course")}</div>
  }

  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          padding: 1em 0;
        `}
      >
        <ChapterGrid courseId={pageContext.pageData.course_id} />
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CourseChapterGridBlock)
