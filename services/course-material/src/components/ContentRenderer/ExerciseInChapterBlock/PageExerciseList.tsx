import { PageWithExercises } from "../../../shared-module/bindings"
import ExerciseBox from "../../../shared-module/components/ExerciseList/ExerciseBox"
import PageBox from "../../../shared-module/components/ExerciseList/PageBox"

export interface PageExerciseListProps {
  page: PageWithExercises
  courseSlug: string
}

const PageExerciseList: React.FC<PageExerciseListProps> = ({ page, courseSlug }) => {
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
                  userPoints={1}
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
