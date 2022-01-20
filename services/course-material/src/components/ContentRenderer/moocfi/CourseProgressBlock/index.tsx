import { css } from "@emotion/css"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import Spinner from "../../../../shared-module/components/Spinner"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import CourseProgress from "./CourseProgress"

const CourseProgressBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant={"small"} />
  }

  if (!pageContext.instance) {
    return (
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        {t("select-course-version-to-see-your-progress")}
      </div>
    )
  }

  return <CourseProgress courseInstanceId={pageContext.instance.id} />
}

export default withErrorBoundary(CourseProgressBlock)
