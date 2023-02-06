import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { fetchUserCourseInstanceChapterExercisesProgress } from "../../../../services/backend"
import { PageWithExercises } from "../../../../shared-module/bindings"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import ExerciseBox from "../../../../shared-module/components/ExerciseList/ExerciseBox"
import PageBox from "../../../../shared-module/components/ExerciseList/PageBox"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "../../../../shared-module/utils/nullability"
import { coursePageSectionRoute } from "../../../../utils/routing"

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
  const getUserCourseInstanceChapterExercisesProgress = useQuery(
    [`user-course-instance-${courseInstanceId}-chapter-${page.chapter_id}-exercises`],
    () =>
      fetchUserCourseInstanceChapterExercisesProgress(
        assertNotNullOrUndefined(courseInstanceId),
        chapterId,
      ),
    {
      select: (data) => {
        return new Map(data.map((x) => [x.exercise_id, x.score_given]))
      },
      enabled: courseInstanceId !== undefined,
    },
  )

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
