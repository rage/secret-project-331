import Link from "next/link"
import { useRouter } from "next/router"

import { PageWithExercises } from "../../../shared-module/bindings"

export interface PageExerciseListProps {
  page: PageWithExercises
}

const PageExerciseList: React.FC<{ page: PageWithExercises }> = ({ page }) => {
  // TODO: This breaks if component is used on a wrong page. courseSlug should be resolved in
  // index.tsx and passed in with props.
  const courseSlug = useRouter().query.courseSlug
  return (
    <div>
      <h5>
        <Link
          href={{
            pathname: "/[courseSlug][urlPath]",
            query: { courseSlug, urlPath: page.url_path },
          }}
        >
          {page.title}
        </Link>
      </h5>
      <div>
        {page.exercises.map((e) => (
          <div key={e.id}>
            <Link
              href={{
                pathname: "/[courseSlug][urlPath]#[anchor]",
                query: { anchor: e.id, courseSlug, urlPath: page.url_path },
              }}
              passHref
            >
              <a>{e.name}</a>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PageExerciseList
