"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ChapterPointsDashboard from "../ChapterPointsDashboard"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import FullWidthTable, { FullWidthTableRow } from "@/components/tables/FullWidthTable"
import {
  getCourseInstanceOptions,
  getCourseInstancePointsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { UserDetail } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { fontWeights, headingFont, secondaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { roundDown } from "@/shared-module/common/utils/numbers"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

interface ProcessedUser {
  user: UserDetail
  totalPoints: number
  chapterPoints: Record<string, number>
}

const NAME = "name"
const NUMBER = "number"
const SCORE = "score"
const EMAIL = "email"
const DOWN_ARROW = "v"

const CourseInstancePointsList: React.FC = () => {
  const { id: courseInstanceId } = useParams<{ id: string }>()
  const { t } = useTranslation()

  const [sorting, setSorting] = useState(NAME)

  const courseInstanceQuery = useQuery({
    ...getCourseInstanceOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })

  const instanceLabel = courseInstanceQuery.data?.name || t("default-instance")

  usePageTitle(
    courseInstanceQuery.isLoading ? null : joinTitleSegments([t("point-summary"), instanceLabel]),
    { order: 10 },
  )

  const crumbs = useMemo(() => [{ isLoading: false as const, label: t("point-summary") }], [t])

  useRegisterBreadcrumbs({
    key: `course-instance:${courseInstanceId}:points`,
    order: 60,
    crumbs,
  })

  function sortUsers(first: ProcessedUser, second: ProcessedUser): number {
    if (sorting === NAME) {
      return `${first.user.last_name} ${first.user.first_name}`.localeCompare(
        `${second.user.last_name} ${second.user.first_name}`,
      )
    } else if (sorting === NUMBER) {
      return first.user.user_id.localeCompare(second.user.user_id)
    } else if (sorting === SCORE) {
      return second.totalPoints - first.totalPoints
    } else if (sorting === EMAIL) {
      return first.user.email.localeCompare(second.user.email)
    }
    return second.chapterPoints[sorting] - first.chapterPoints[sorting]
  }

  const getPointsList = useQuery({
    ...getCourseInstancePointsOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        color: #707070;
        font-weight: 600;
        font-family: ${headingFont};

        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      <h2
        className={css`
          font-size: 45px;
          line-height: 45px;
        `}
      >
        {t("point-summary")}: {instanceLabel}
      </h2>
      <QueryResult query={getPointsList}>
        {(data) => {
          const instanceTotalPoints = data.chapter_points.reduce(
            (prev, curr) => prev + curr.score_total,
            0,
          )

          const courseId =
            courseInstanceQuery.data?.course_id ??
            (data.chapter_points.length > 0 ? data.chapter_points[0].course_id : undefined)

          return (
            <>
              <ChapterPointsDashboard
                chapterScores={data.chapter_points.map((p) => ({
                  id: p.id,
                  name: p.name,
                  value: `${roundDown(p.score_given, 2)}/${p.score_total * data.users.length}`,
                }))}
                userCount={data.users.length}
              />
              <FullWidthTable>
                <thead
                  className={css`
                    th {
                      font-weight: ${fontWeights.medium} !important;
                    }
                  `}
                >
                  <tr
                    className={css`
                      text-align: left;
                      font-size: 13px;
                    `}
                  >
                    <th>
                      {t("label-user-id")}{" "}
                      <a href="#number" onClick={() => setSorting(NUMBER)}>
                        {DOWN_ARROW}
                      </a>
                    </th>
                    <th>
                      {t("student-name")}{" "}
                      <a href="#name" onClick={() => setSorting(NAME)}>
                        {DOWN_ARROW}
                      </a>
                    </th>

                    <th>
                      {t("label-email")}{" "}
                      <a href="#email" onClick={() => setSorting(EMAIL)}>
                        {DOWN_ARROW}
                      </a>
                    </th>
                    <th>
                      {t(SCORE)}{" "}
                      <a href="#score" onClick={() => setSorting(SCORE)}>
                        {DOWN_ARROW}
                      </a>
                    </th>

                    {data.chapter_points.map((c) => {
                      // oxlint-disable-next-line i18next/no-literal-string
                      const courseSorting = `#ch${c.chapter_number}`
                      return (
                        <th key={c.id}>
                          {t("title-chapter-only-number", { "chapter-number": c.chapter_number })}{" "}
                          <a
                            href={courseSorting}
                            onClick={() => setSorting(courseSorting.slice(1))}
                          >
                            {DOWN_ARROW}
                          </a>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody
                  className={css`
                    font-family: ${secondaryFont};
                    font-weight: ${fontWeights.medium};
                  `}
                >
                  {data.users
                    .map((user) => {
                      const totalPoints = Object.values(
                        data.user_chapter_points[user.user_id] || {},
                      ).reduce((prev, curr) => prev + curr, 0)
                      const userChapterPoints = data.user_chapter_points[user.user_id] || {}
                      const chapterPoints = Object.fromEntries(
                        data.chapter_points.map((c) => [
                          // oxlint-disable-next-line i18next/no-literal-string
                          `ch${c.chapter_number}`,
                          userChapterPoints[c.id] || 0,
                        ]),
                      )
                      return { user, totalPoints, chapterPoints }
                    })
                    .toSorted(sortUsers)
                    .map(({ user, totalPoints }) => {
                      return (
                        <FullWidthTableRow key={user.user_id}>
                          <td>
                            {courseId ? (
                              <Link href={courseUserStatusSummaryRoute(courseId, user.user_id)}>
                                {user.user_id}
                              </Link>
                            ) : (
                              user.user_id
                            )}
                          </td>
                          <td>
                            {user.first_name} {user.last_name}
                          </td>

                          <td>{user.email}</td>
                          <td>
                            {roundDown(totalPoints, 2)}/{instanceTotalPoints} (
                            {instanceTotalPoints > 0
                              ? roundDown((totalPoints / instanceTotalPoints) * 100, 0)
                              : 0}
                            %)
                          </td>

                          {data.chapter_points.map((c) => {
                            const userChapterPoints = data.user_chapter_points[user.user_id] || {}
                            const chapterPoints = userChapterPoints[c.id] || 0
                            return (
                              <td key={user.user_id + c.id}>
                                {roundDown(chapterPoints, 2)}/{c.score_total}
                              </td>
                            )
                          })}
                        </FullWidthTableRow>
                      )
                    })}
                </tbody>
              </FullWidthTable>
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CourseInstancePointsList))
