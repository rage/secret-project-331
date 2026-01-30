"use client"

import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import TopLevelPages from "./TopLevelPage"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { currentPageDataAtom, viewStatusAtom } from "@/state/course-material/selectors"

const TopLevelPageBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const viewStatus = useAtomValue(viewStatusAtom)
  const pageData = useAtomValue(currentPageDataAtom)

  if (viewStatus !== "ready") {
    return <Spinner variant={"medium"} />
  }

  const courseId = pageData?.course_id

  if (!courseId) {
    return <ErrorBanner variant={"readOnly"} error={t("error-page-does-not-belong-to-chapter")} />
  }
  return (
    <div>
      <TopLevelPages courseId={courseId} />
    </div>
  )
}

export default withErrorBoundary(TopLevelPageBlock)
