import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import Spinner from "../../../../shared-module/components/Spinner"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ChapterProgress from "./ChapterProgress"

const ChapterProgressBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant={"small"} />
  }

  if (!pageContext.instance) {
    return <div>{t("title-select-course-version-to-see-your-progress")}</div>
  }
  if (!pageContext.pageData.chapter_id) {
    return <div>{t("error-page-does-not-belong-to-chapter")}</div>
  }
  return (
    <ChapterProgress
      courseInstanceId={pageContext.instance.id}
      chapterId={pageContext.pageData.chapter_id}
    />
  )
}

export default withErrorBoundary(ChapterProgressBlock)
