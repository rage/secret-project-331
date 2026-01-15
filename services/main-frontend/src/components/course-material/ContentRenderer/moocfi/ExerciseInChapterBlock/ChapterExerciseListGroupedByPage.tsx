"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { fetchAllChaptersByCourseId } from "@/services/backend/chapters"
import { fetchUserCourseInstanceChapterExercisesProgress } from "@/services/course-material/backend"
import { PageWithExercises } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import ExerciseBox from "@/shared-module/common/components/ExerciseList/ExerciseBox"
import PageBox from "@/shared-module/common/components/ExerciseList/PageBox"
import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { courseMaterialAtom } from "@/state/course-material"
import { coursePageSectionRoute } from "@/utils/course-material/routing"

export interface ChapterExerciseListGroupedByPageProps {
  chapterId: string
  courseInstanceId: string | undefined
  courseSlug: string
  organizationSlug: string
  page: PageWithExercises
}

const ChapterExerciseListGroupedByPage: React.FC<
  React.PropsWithChildren<ChapterExerciseListGroupedByPageProps>
> = ({ chapterId, courseInstanceId, courseSlug, organizationSlug, page }) => {
  const loginStateContext = useContext(LoginStateContext)
  const { t } = useTranslation()
  const courseMaterialState = useAtomValue(courseMaterialAtom)

  const courseId =
    courseMaterialState.status === "ready" ? (courseMaterialState.course?.id ?? null) : null

  const chaptersQuery = useQuery({
    queryKey: ["chapters", courseId],
    queryFn: () => fetchAllChaptersByCourseId(courseId!),
    enabled: !!courseId,
  })

  const chapter = chaptersQuery.data?.find((c) => c.id === chapterId)
  const course = courseMaterialState.course
  const chapterLockingEnabled = course?.chapter_locking_enabled ?? false
  const getUserCourseInstanceChapterExercisesProgress = useQuery({
    queryKey: [
      `user-course-instance-${courseInstanceId}-chapter-${page.chapter_id}-exercises`,
      chapterId,
    ],
    queryFn: () =>
      fetchUserCourseInstanceChapterExercisesProgress(
        assertNotNullOrUndefined(courseInstanceId),
        chapterId,
      ),
    select: (data) => {
      return new Map(data.map((x) => [x.exercise_id, x.score_given]))
    },
    enabled: courseInstanceId !== undefined,
  })

  if (getUserCourseInstanceChapterExercisesProgress.isError) {
    return (
      <ErrorBanner
        variant={"readOnly"}
        error={getUserCourseInstanceChapterExercisesProgress.error}
      />
    )
  }

  if (
    getUserCourseInstanceChapterExercisesProgress.isLoading &&
    getUserCourseInstanceChapterExercisesProgress.fetchStatus !== "idle"
  ) {
    // No spinner when idle because this component still works when we are logged out and the query is not enabled
    return <Spinner variant={"medium"} />
  }

  return (
    <>
      <>
        {page.exercises.length !== 0 && (
          <>
            <PageBox pageTitle={page.title} />
            {chapterLockingEnabled && (
              <div
                className={css`
                  padding: 1rem;
                  background-color: ${baseTheme.colors.yellow[50]};
                  border-left: 4px solid ${baseTheme.colors.yellow[500]};
                  border-radius: 4px;
                  margin: 1rem 0;
                `}
              >
                <p
                  className={css`
                    margin: 0;
                    font-family: ${primaryFont};
                    font-size: 0.9375rem;
                    line-height: 1.6;
                    color: ${baseTheme.colors.gray[700]};
                  `}
                >
                  {t("exercises-done-through-locking-notification")}
                </p>
              </div>
            )}
            <div>
              {page.exercises.map((e) => {
                let userPoints = null

                if (loginStateContext.signedIn) {
                  userPoints = getUserCourseInstanceChapterExercisesProgress?.data?.get(e.id) ?? 0
                }
                return (
                  <div key={e.id}>
                    <ExerciseBox
                      url={coursePageSectionRoute(
                        organizationSlug,
                        courseSlug,
                        page.url_path,
                        e.id,
                      )}
                      // eslint-disable-next-line i18next/no-literal-string
                      bg={"rgb(242, 245, 247)"}
                      exerciseIndex={e.order_number + 1}
                      exerciseTitle={e.name}
                      scoreMaximum={e.score_maximum}
                      userPoints={userPoints}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </>
    </>
  )
}

export default ChapterExerciseListGroupedByPage
