// progresstabbackend.tsx
import React, { useEffect, useMemo, useState } from "react"

/home/janitus/secret-project-331/services/course-material/src/services/backend.ts
src/services/backend.ts

import {
  fetchChaptersInTheCourse,
  fetchUserCourseInstanceChapterExercisesProgress,
  getUserDetails,
} from "../../../../../../../src/services/backend"

import {
  ChaptersWithStatus,
  UserCourseChapterExerciseProgress,
  UserDetail,
} from "@/shared-module/common/bindings"

type Props = {
  courseId: string
  courseInstanceId: string
}

type ChapterRow = {
  chapterId: string
  title: string
  exerciseCount: number
  solvedCount: number
  points: number
}

const ProgressTabBackend: React.FC<Props> = ({ courseId, courseInstanceId }) => {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [chapters, setChapters] = useState<ChaptersWithStatus | null>(null)
  const [chapterRows, setChapterRows] = useState<ChapterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        // 1) who am I
        const me = await getUserDetails()

        // 2) chapters of this course
        const chs = await fetchChaptersInTheCourse(courseId)

        // 3) for each chapter, fetch my exercise progress (in parallel)
        const rows = await Promise.all(
          chs.chapters.map(async (ch) => {
            const exProgress: UserCourseChapterExerciseProgress[] =
              await fetchUserCourseInstanceChapterExercisesProgress(
                courseInstanceId,
                ch.id,
              )

            const exerciseCount = exProgress.length
            const solvedCount = exProgress.filter((e) => (e.score_given ?? 0) > 0).length
            const points = Number(
              exProgress.reduce((sum, e) => sum + (e.score_given ?? 0), 0).toFixed(2),
            )

            return {
              chapterId: ch.id,
              title: ch.title ?? ch.slug ?? "(untitled chapter)",
              exerciseCount,
              solvedCount,
              points,
            } as ChapterRow
          }),
        )

        if (!cancelled) {
          setUser(me)
          setChapters(chs)
          setChapterRows(rows.sort((a, b) => a.title.localeCompare(b.title)))
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load progress")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [courseId, courseInstanceId])

  const totalPoints = useMemo(
    () => chapterRows.reduce((s, r) => s + r.points, 0),
    [chapterRows],
  )

  if (loading) return <div>Loading progress…</div>
  if (error) return <div style={{ color: "crimson" }}>Error: {error}</div>

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h2 style={{ margin: 0 }}>My course progress</h2>
          {user && (
            <div style={{ opacity: 0.8 }}>
              {user.first_name} {user.last_name} &middot; {user.email}
            </div>
          )}
        </div>
        <div>
          <strong>Total points:</strong> {totalPoints.toFixed(2)}
        </div>
      </header>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Chapter</th>
            <th style={th}>Exercises</th>
            <th style={th}>Solved</th>
            <th style={th}>Points</th>
          </tr>
        </thead>
        <tbody>
          {chapterRows.map((row) => (
            <tr key={row.chapterId}>
              <td style={td}>{row.title}</td>
              <td style={td}>{row.exerciseCount}</td>
              <td style={td}>{row.solvedCount}</td>
              <td style={td}>{row.points.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {chapters && chapters.chapters.length === 0 && (
        <div>No chapters found for this course.</div>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  padding: "8px 6px",
  fontWeight: 600,
}

const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "8px 6px",
}

export default ProgressTabBackend
