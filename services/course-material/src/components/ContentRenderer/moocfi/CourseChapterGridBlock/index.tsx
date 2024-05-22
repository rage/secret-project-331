import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../../../contexts/PageContext"

import ChapterGrid from "./ChapterGrid"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CourseChapterGridBlock: React.FC<React.PropsWithChildren<unknown>> = () => {
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
      <div>
        <ChapterGrid courseId={pageContext.pageData.course_id} />
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CourseChapterGridBlock)
