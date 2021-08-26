import Link from "next/link"
import { useRouter } from "next/router"

import { PageWithExercises } from "../../../shared-module/bindings"
import ExerciseListBox from "../../../shared-module/components/ExerciseList/ExerciseBox"

export interface PageExerciseListProps {
  page: PageWithExercises
}

const PageExerciseList: React.FC<{ page: PageWithExercises }> = ({ page }) => {
  // TODO: This breaks if component is used on a wrong page. courseSlug should be resolved in
  // index.tsx and passed in with props.
  const courseSlug = useRouter().query.courseSlug
  return (
    <div>
      {page.order_number !== 0 ? (
        <ExerciseListBox
          pageIndex={page.order_number}
          pageTitle={page.title}
          selected={false}
          variant="link"
          pageLink={`/${courseSlug}${page.url_path}`}
        />
      ) : null}
      <div>
        {page.exercises.map((e) => (
          <div key={e.id}>
            <Link href={`/${courseSlug}${page.url_path}#${e.id}`} passHref>
              <a href="replace">{e.name}</a>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PageExerciseList
