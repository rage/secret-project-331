import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import GenericInfobox from "../../../../shared-module/components/GenericInfobox"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ChapterProgress from "./ChapterProgress"

const ChapterProgressBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)
  const loginStateContext = useContext(LoginStateContext)

  if (pageContext.state !== "ready" || loginStateContext.isLoading) {
    return <Spinner variant={"small"} />
  }
  if (!loginStateContext.signedIn) {
    return <GenericInfobox>{t("please-log-in-to-see-your-progress")}</GenericInfobox>
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
