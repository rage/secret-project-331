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
        <Link href={`/${courseSlug}${page.url_path}`}>{page.title}</Link>
      </h5>
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
