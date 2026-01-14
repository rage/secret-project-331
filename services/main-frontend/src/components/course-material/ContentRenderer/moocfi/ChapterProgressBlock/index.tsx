"use client"

import { useAtomValue } from "jotai"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import ChapterProgress from "./ChapterProgress"

import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { courseMaterialAtom } from "@/state/course-material"

const ChapterProgressBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = () => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const loginStateContext = useContext(LoginStateContext)

  if (courseMaterialState.status !== "ready" || loginStateContext.isLoading) {
    return <Spinner variant={"small"} />
  }
  if (!loginStateContext.signedIn) {
    return <GenericInfobox>{t("please-log-in-to-see-your-progress")}</GenericInfobox>
  }

  if (!courseMaterialState.instance) {
    return <div>{t("title-select-course-version-to-see-your-progress")}</div>
  }
  if (!courseMaterialState.page?.chapter_id) {
    return <div>{t("error-page-does-not-belong-to-chapter")}</div>
  }

  return (
    <ChapterProgress
      courseInstanceId={courseMaterialState.instance.id}
      chapterId={courseMaterialState.page.chapter_id}
    />
  )
}

export default withErrorBoundary(ChapterProgressBlock)
