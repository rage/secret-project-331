"use client"

import { useAtomValue } from "jotai"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Infobox, LoadingRegion } from "@/shared-module/components"
import { courseMaterialAtom } from "@/state/course-material"

import type { BlockRendererProps } from "../.."
import LockChapter from "./LockChapter"

const LockChapterBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = (
  props,
) => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const loginStateContext = useContext(LoginStateContext)

  if (courseMaterialState.status !== "ready" || loginStateContext.isLoading) {
    return <LoadingRegion />
  }
  if (!loginStateContext.signedIn) {
    return <Infobox>{t("please-log-in-to-lock-chapter")}</Infobox>
  }

  if (!courseMaterialState.page?.chapter_id) {
    return <div>{t("error-page-does-not-belong-to-chapter")}</div>
  }

  return <LockChapter chapterId={courseMaterialState.page.chapter_id} blockProps={props} />
}

export default withErrorBoundary(LockChapterBlock)
