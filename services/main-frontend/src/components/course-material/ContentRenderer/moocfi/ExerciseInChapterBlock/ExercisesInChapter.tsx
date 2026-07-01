"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"

import ChapterExerciseListGroupedByPage from "./ChapterExerciseListGroupedByPage"

import { getCourseMaterialChapterPagesWithExercisesOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { QueryResult } from "@/shared-module/components"

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
      <QueryResult query={getChaptersPagesWithExercises}>
        {(data) =>
          courseSlug && organizationSlug ? (
            <>
              {data.map((page) => (
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
          ) : null
        }
      </QueryResult>
    </div>
  )
}

export default ExercisesInChapter
