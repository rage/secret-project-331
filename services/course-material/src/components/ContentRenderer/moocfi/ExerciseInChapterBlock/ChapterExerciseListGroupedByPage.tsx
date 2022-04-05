import { useQuery } from "react-query"

import { fetchUserCourseInstanceChapterExercisesProgress } from "../../../../services/backend"
import { PageWithExercises } from "../../../../shared-module/bindings"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import ExerciseBox from "../../../../shared-module/components/ExerciseList/ExerciseBox"
import PageBox from "../../../../shared-module/components/ExerciseList/PageBox"
import Spinner from "../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../shared-module/styles"
import { coursePageSectionRoute } from "../../../../utils/routing"

export interface ChapterExerciseListGroupedByPageProps {
  chapterId: string
  courseInstanceId: string
  courseSlug: string
  organizationSlug: string
  page: PageWithExercises
}

const ChapterExerciseListGroupedByPage: React.FC<ChapterExerciseListGroupedByPageProps> = ({
  chapterId,
  courseInstanceId,
  courseSlug,
  organizationSlug,
  page,
}) => {
  const getUserCourseInstanceChapterExercisesProgress = useQuery(
    `user-course-instance-${courseInstanceId}-chapter-${page.chapter_id}-exercises`,
    () => fetchUserCourseInstanceChapterExercisesProgress(courseInstanceId, chapterId),
    {
      select: (data) => {
        return new Map(data.map((x) => [x.exercise_id, x.score_given]))
      },
    },
  )

  return (
    <>
      {getUserCourseInstanceChapterExercisesProgress.isError && (
        <ErrorBanner
          variant={"readOnly"}
          error={getUserCourseInstanceChapterExercisesProgress.error}
        />
      )}
      {(getUserCourseInstanceChapterExercisesProgress.isLoading ||
        getUserCourseInstanceChapterExercisesProgress.isIdle) && <Spinner variant={"medium"} />}
      {getUserCourseInstanceChapterExercisesProgress.isSuccess && (
        <>
          {page.exercises.length !== 0 && (
            <>
              <PageBox pageTitle={page.title} />
              <div>
                {page.exercises.map((e, index) => (
                  <div key={e.id}>
                    <ExerciseBox
                      url={coursePageSectionRoute(
                        organizationSlug,
                        courseSlug,
                        page.url_path,
                        e.id,
                      )}
                      bg={index % 2 !== 0 ? baseTheme.colors.blue[100] : baseTheme.colors.blue[200]}
                      exerciseIndex={e.order_number}
                      exerciseTitle={e.name}
                      scoreMaximum={e.score_maximum}
                      userPoints={getUserCourseInstanceChapterExercisesProgress.data.get(e.id) ?? 0}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

export default ChapterExerciseListGroupedByPage
