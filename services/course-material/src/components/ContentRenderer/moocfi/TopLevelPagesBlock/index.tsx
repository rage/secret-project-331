import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import ErrorBanner from "../../../../shared-module/common/components/ErrorBanner"
import Spinner from "../../../../shared-module/common/components/Spinner"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/common/utils/withErrorBoundary"

import TopLevelPages from "./TopLevelPage"

const TopLevelPageBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  const courseId = pageContext.pageData.course_id

  if (!courseId) {
    return <ErrorBanner error={t("error-page-does-not-belong-to-chapter")} />
  }
  return (
    <div>
      <TopLevelPages courseId={courseId} />
    </div>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(TopLevelPageBlock))
