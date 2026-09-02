"use client"

import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { LoadingRegion } from "@/shared-module/components"
import { currentPageDataAtom, viewStatusAtom } from "@/state/course-material/selectors"

import type { BlockRendererProps } from "../.."
import TopLevelPages from "./TopLevelPage"

const TopLevelPageBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const viewStatus = useAtomValue(viewStatusAtom)
  const pageData = useAtomValue(currentPageDataAtom)

  if (viewStatus !== "ready") {
    return <LoadingRegion />
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
