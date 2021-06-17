import { ChapterPagesWithExercises } from "../../../services/backend"
import Link from "next/link"
import { useRouter } from "next/router"

const PageWithExercises: React.FC<{ page: ChapterPagesWithExercises }> = ({ page }) => {
  const coursePath = useRouter().asPath
  return (
    <div>
      <h5>
        <Link href={coursePath + page.url_path}>{page.title}</Link>
      </h5>
      <div>
        {page.exercises.map((e) => (
          <div key={e.id}>
            <Link href={coursePath + page.url_path + "#" + e.id} passHref>
              <a>{e.name}</a>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PageWithExercises
