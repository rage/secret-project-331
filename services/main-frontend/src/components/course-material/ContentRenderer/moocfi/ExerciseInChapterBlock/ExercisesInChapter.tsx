"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"

import ChapterExerciseListGroupedByPage from "./ChapterExerciseListGroupedByPage"

import { getCourseMaterialChapterPagesWithExercisesOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const ExercisesInChapter: React.FC<
  React.PropsWithChildren<{ chapterId: string; courseInstanceId: string | undefined }>
> = ({ chapterId, courseInstanceId }) => {
  const getChaptersPagesWithExercises = useQuery({
    ...getCourseMaterialChapterPagesWithExercisesOptions({
      path: {
        chapter_id: chapterId,
      },
    }),
  })
  const params = useParams<{ organizationSlug: string; courseSlug: string }>()
  const courseSlug = params?.courseSlug
  const organizationSlug = params?.organizationSlug

  return (
    <div>
      {getChaptersPagesWithExercises.isError && (
        <ErrorBanner variant={"readOnly"} error={getChaptersPagesWithExercises.error} />
      )}
      {getChaptersPagesWithExercises.isLoading && <Spinner variant={"medium"} />}
      {getChaptersPagesWithExercises.isSuccess && courseSlug && organizationSlug && (
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
