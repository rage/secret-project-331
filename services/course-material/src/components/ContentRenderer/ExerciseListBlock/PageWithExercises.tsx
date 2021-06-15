import { ChaptersPagesWithExercises } from "../../../services/backend"

const PageWithExercises: React.FC<{ page: ChaptersPagesWithExercises }> = ({ page }) => {
  return (
    <div>
      <h5>
        <a href={page.url_path}>{page.title}</a>
      </h5>
      <div>
        {page.exercises.map((e) => (
          <div key={e.id}>{e.name}</div>
        ))}
      </div>
    </div>
  )
}

export default PageWithExercises
