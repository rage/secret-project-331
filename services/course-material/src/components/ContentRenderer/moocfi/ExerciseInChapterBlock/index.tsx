import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import Spinner from "../../../../shared-module/components/Spinner"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ExercisesInChapter from "./ExercisesInChapter"

const ExerciseInChapterBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<unknown>>
> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant={"small"} />
  }

  const chapterId = pageContext.pageData.chapter_id
  const courseInstanceId = pageContext.instance?.id

  if (!chapterId) {
    return <pre>{t("error-page-does-not-belong-to-chapter")}</pre>
  }

  return (
    <div>
      <ExercisesInChapter chapterId={chapterId} courseInstanceId={courseInstanceId} />
    </div>
  )
}

export default withErrorBoundary(ExerciseInChapterBlock)
