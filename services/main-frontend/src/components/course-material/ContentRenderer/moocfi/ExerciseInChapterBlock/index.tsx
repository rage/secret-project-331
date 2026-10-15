"use client"

import styled from "@emotion/styled"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Disclosure, LoadingRegion } from "@/shared-module/components"
import { courseMaterialAtom } from "@/state/course-material"
import { currentPageDataAtom } from "@/state/course-material/selectors"

import type { BlockRendererProps } from "../.."
import ExercisesInChapter from "./ExercisesInChapter"

const Wrapper = styled.div`
  margin: 0 0 5rem 0;
`

const ExerciseInChapterBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<unknown>>
> = () => {
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const pageData = useAtomValue(currentPageDataAtom)

  if (courseMaterialState.status !== "ready") {
    return <LoadingRegion />
  }

  const chapterId = pageData?.chapter_id
  const courseInstanceId = courseMaterialState.instance?.id

  if (!chapterId) {
    return <pre>{t("error-page-does-not-belong-to-chapter")}</pre>
  }

  return (
    <Wrapper>
      <Disclosure title={t("exercises-in-this-chapter")}>
        <ExercisesInChapter chapterId={chapterId} courseInstanceId={courseInstanceId} />
      </Disclosure>
    </Wrapper>
  )
}

export default withErrorBoundary(ExerciseInChapterBlock)
