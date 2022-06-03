import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import GenericInfobox from "../../../../shared-module/components/GenericInfobox"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import CourseProgress from "./CourseProgress"

const CourseProgressBlock: React.FC<BlockRendererProps<unknown>> = () => {
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
    return <div>{t("select-course-version-to-see-your-progress")}</div>
  }

  return <CourseProgress courseInstanceId={pageContext.instance.id} />
}

export default withErrorBoundary(CourseProgressBlock)
