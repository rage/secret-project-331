"use client"
import { useQuery } from "@tanstack/react-query"
import React from "react"

import ChapterExerciseListGroupedByPage from "./ChapterExerciseListGroupedByPage"

import { fetchChaptersPagesWithExercises } from "@/services/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"

const ExercisesInChapter: React.FC<
  React.PropsWithChildren<{ chapterId: string; courseInstanceId: string | undefined }>
> = ({ chapterId, courseInstanceId }) => {
  const getChaptersPagesWithExercises = useQuery({
    queryKey: [`chapter-${chapterId}-pages-with-exercises`],
    queryFn: () => fetchChaptersPagesWithExercises(chapterId),
  })
  const courseSlug = useQueryParameter("courseSlug")
  const organizationSlug = useQueryParameter("organizationSlug")

  return (
    <div>
      {getChaptersPagesWithExercises.isError && (
        <ErrorBanner variant={"readOnly"} error={getChaptersPagesWithExercises.error} />
      )}
      {getChaptersPagesWithExercises.isLoading && <Spinner variant={"medium"} />}
      {getChaptersPagesWithExercises.isSuccess && (
        <>
          {getChaptersPagesWithExercises.data.map((page) => (
            <div key={page.id}>
              <ChapterExerciseListGroupedByPage
                page={page}
                courseSlug={courseSlug}
                courseInstanceId={courseInstanceId}
                chapterId={chapterId}
                organizationSlug={organizationSlug}
              />
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default ExercisesInChapter
