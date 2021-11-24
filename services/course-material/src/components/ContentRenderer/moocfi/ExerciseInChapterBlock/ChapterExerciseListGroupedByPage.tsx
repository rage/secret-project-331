import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchUserCourseInstanceChapterExercisesProgress } from "../../../../services/backend"
import { PageWithExercises } from "../../../../shared-module/bindings"
import ExerciseBox from "../../../../shared-module/components/ExerciseList/ExerciseBox"
import PageBox from "../../../../shared-module/components/ExerciseList/PageBox"
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
  const { t } = useTranslation()
  const { isLoading, error, data } = useQuery(
    `user-course-instance-${courseInstanceId}-chapter-${page.chapter_id}-exercises`,
    async () => {
      const data = await fetchUserCourseInstanceChapterExercisesProgress(
        courseInstanceId,
        chapterId,
      )
      return new Map(data.map((x) => [x.exercise_id, x.score_given]))
    },
  )

  if (error) {
    return (
      <div>
        <h1>{t("error-title")}</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>{t("loading")}</div>
  }

  return (
    <>
      {page.exercises.length !== 0 && (
        <>
          <PageBox pageTitle={page.title} />
          <div>
            {page.exercises.map((e) => (
              <div key={e.id}>
                <ExerciseBox
                  url={coursePageSectionRoute(organizationSlug, courseSlug, page.url_path, e.id)}
                  exerciseIndex={e.order_number}
                  exerciseTitle={e.name}
                  scoreMaximum={e.score_maximum}
                  userPoints={data.get(e.id) ?? 0}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default ChapterExerciseListGroupedByPage
