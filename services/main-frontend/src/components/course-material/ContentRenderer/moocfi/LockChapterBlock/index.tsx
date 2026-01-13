"use client"
import { useAtomValue } from "jotai"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import LockChapter from "./LockChapter"

import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { courseMaterialAtom } from "@/state/course-material"

const LockChapterBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = (
  props,
) => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const loginStateContext = useContext(LoginStateContext)

  if (courseMaterialState.status !== "ready" || loginStateContext.isLoading) {
    return <Spinner variant={"small"} />
  }
  if (!loginStateContext.signedIn) {
    return <GenericInfobox>{t("please-log-in-to-lock-chapter")}</GenericInfobox>
  }

  if (!courseMaterialState.page?.chapter_id) {
    return <div>{t("error-page-does-not-belong-to-chapter")}</div>
  }

  return <LockChapter chapterId={courseMaterialState.page.chapter_id} blockProps={props} />
}

export default withErrorBoundary(LockChapterBlock)
