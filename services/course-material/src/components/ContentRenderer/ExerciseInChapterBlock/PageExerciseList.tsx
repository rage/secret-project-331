import { PageWithExercises } from "../../../shared-module/bindings"
import ExerciseBox from "../../../shared-module/components/ExerciseList/ExerciseBox"
import PageBox from "../../../shared-module/components/ExerciseList/PageBox"

export interface PageExerciseListProps {
  page: PageWithExercises
  courseSlug: string
  courseInstanceId: string
}

const PageExerciseList: React.FC<PageExerciseListProps> = ({
  page,
  courseSlug,
  courseInstanceId,
}) => {
  return (
    <>
      {page.exercises.length !== 0 && (
        <>
          <PageBox pageTitle={page.title} />
          <div>
            {page.exercises.map((e) => (
              <div key={e.id}>
                <ExerciseBox
                  url={`/${courseSlug}${page.url_path}#${e.id}`}
                  exerciseIndex={e.order_number}
                  exerciseTitle={e.name}
                  scoreMaximum={e.score_maximum}
                  // userPoints={TODO: Fetch user points from API here for each exercise_id?}
                  courseInstanceId={courseInstanceId}
                  exerciseId={e.id}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default PageExerciseList
