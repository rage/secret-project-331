import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import TopLevelPages from "./TopLevelPage"

const TopLevelPageBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  const courseId = pageContext.pageData.course_id

  if (!courseId) {
    return <ErrorBanner variant={"readOnly"} error={t("error-page-does-not-belong-to-chapter")} />
  }
  return (
    <div>
      <TopLevelPages courseId={courseId} />
    </div>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(TopLevelPageBlock))
