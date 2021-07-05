import Link from "next/link"
import React, { useState, useEffect } from "react"
import { useQuery } from "react-query"
import useQueryParameter from "../../../hooks/useQueryParameter"
import { ChapterInTheCourse, fetchChaptersInTheCourse } from "../../../services/backend"
import { chapterBox } from "../../../styles/componentStyles"
import dontRenderUntilQueryParametersReady from "../../../utils/dontRenderUntilQueryParametersReady"
import GenericLoading from "../../GenericLoading"
import { differenceInSeconds } from "date-fns"

const ChapterGrid: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [now, setNow] = useState(new Date())
  const { data, error, isLoading } = useQuery(`course-${courseId}-chapters`, () =>
    fetchChaptersInTheCourse(courseId),
  )
  const courseSlug = useQueryParameter("courseSlug")

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <div>
      <h3>Chapters in this course</h3>
      {data
        .sort((a, b) => a.chapter_number - b.chapter_number)
        .map((chapter) => {
          return <Chapter key={chapter.id} now={now} chapter={chapter} courseSlug={courseSlug} />
        })}
    </div>
  )
}

interface ChapterProps {
  now: Date
  chapter: ChapterInTheCourse
  courseSlug: string
}
const Chapter: React.FC<ChapterProps> = ({ now, chapter, courseSlug }) => {
  if (chapter.status == "open") {
    return (
      <div key={chapter.id} className={chapterBox}>
        <Link href={`/${courseSlug}/chapter-${chapter.chapter_number}`}>
          <a>
            Chapter {chapter.chapter_number}: {chapter.name}
          </a>
        </Link>
      </div>
    )
  } else {
    let closedUntil
    if (chapter.opens_at) {
      const diff = differenceInSeconds(chapter.opens_at, now)
      if (diff < 1) {
        closedUntil = "Opens soon"
      } else if (diff < 60 * 30) {
        closedUntil = `Opens in ${diff} seconds`
      } else {
        closedUntil = `Opens at ${chapter.opens_at.toLocaleDateString()}`
      }
    } else {
      closedUntil = "Closed"
    }
    return (
      <div key={chapter.id} className={chapterBox}>
        Chapter {chapter.chapter_number}: {chapter.name} <br />
        {closedUntil}
      </div>
    )
  }
}

export default dontRenderUntilQueryParametersReady(ChapterGrid)
