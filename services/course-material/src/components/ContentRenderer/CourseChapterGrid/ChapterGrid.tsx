import Link from "next/link"
import React from "react"
import { useQuery } from "react-query"
import useQueryParameter from "../../../hooks/useQueryParameter"
import { fetchChaptersInTheCourse } from "../../../services/backend"
import { chapterBox } from "../../../styles/componentStyles"
import dontRenderUntilQueryParametersReady from "../../../utils/dontRenderUntilQueryParametersReady"
import GenericLoading from "../../GenericLoading"

const ChapterGrid: React.FC<{ courseId: string }> = ({ courseId }) => {
  const { data, error, isLoading } = useQuery(`course-${courseId}-chapters`, () =>
    fetchChaptersInTheCourse(courseId),
  )
  const courseSlug = useQueryParameter("courseSlug")

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <div>
      <h3>Chapters in this course</h3>
      {data.map((chapter) => {
        return (
          <div key={chapter.id} className={chapterBox}>
            <Link href={`/${courseSlug}/chapter-${chapter.chapter_number}`}>
              <a>{chapter.name}</a>
            </Link>
          </div>
        )
      })}
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ChapterGrid)
