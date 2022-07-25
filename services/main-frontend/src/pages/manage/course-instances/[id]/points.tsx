import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import { getPoints } from "../../../../services/backend/course-instances"
import { User } from "../../../../shared-module/bindings"
import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { roundDown } from "../../../../shared-module/utils/numbers"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface CourseInstancePointsListProps {
  query: SimplifiedUrlQuery<"id">
}

interface ProcessedUser {
  user: User
  totalPoints: number
  chapterPoints: Record<string, number>
}

const NAME = "name"
const NUMBER = "number"
const SCORE = "score"
const EMAIL = "email"
const DOWN_ARROW = "v"

const CourseInstancePointsList: React.FC<CourseInstancePointsListProps> = ({ query }) => {
  const courseInstanceId = query.id
  const { t } = useTranslation()

  const [sorting, setSorting] = useState(NAME)

  function sortUsers(first: ProcessedUser, second: ProcessedUser): number {
    if (sorting == NAME) {
      return `${first.user.last_name} ${first.user.first_name}`.localeCompare(
        `${second.user.last_name} ${second.user.first_name}`,
      )
    } else if (sorting == NUMBER) {
      return first.user.id.localeCompare(second.user.id)
    } else if (sorting == SCORE) {
      return first.totalPoints - second.totalPoints
    } else if (sorting == EMAIL) {
      return first.user.email.localeCompare(second.user.email)
    } else {
      return first.chapterPoints[sorting] - second.chapterPoints[sorting]
    }
  }

  const getPointsList = useQuery([`point-list-${courseInstanceId}`], () =>
    getPoints(courseInstanceId))

  const instanceTotalPoints = getPointsList.isSuccess
    ? getPointsList.data.chapter_points.reduce((prev, curr) => prev + curr.score_total, 0)
    : 0

  return (
    <Layout navVariant="simple">
      <div
        className={css`
          display: flex;
          flex-direction: column;
          color: #707070;
          font-weight: 600;
          font-family: Josefin Sans, sans-serif;

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
            text-transform: capitalize;
          `}
        >
          {t("point-summary")}: {courseInstanceId}
        </h2>
        {getPointsList.isError && <ErrorBanner variant={"readOnly"} error={getPointsList.error} />}
        {(getPointsList.isLoading || getPointsList.isIdle) && <Spinner variant={"medium"} />}
        {getPointsList.isSuccess && (
          <>
            <div
              className={css`
                margin-top: 51px;
                padding: 44px 57px 49px 57px;

                background: #ffffff;
                border: 1px solid rgba(190, 190, 190, 0.6);
              `}
            >
              <h3
                className={css`
                  text-transform: uppercase;
                `}
              >
                {t("total-point-dashboard")}
              </h3>
              <div
                className={css`
                  margin-top: 22px;

                  font-size: 22px;
                  line-height: 22px;
                  text-transform: capitalize;
                `}
              >
                {t("number-of-students")}: {getPointsList.data.users.length}
              </div>
              <div
                className={css`
                  column-gap: 36px;
                  display: flex;
                  flex-direction: row;
                  flex-wrap: wrap;
                `}
              >
                {getPointsList.data.chapter_points.map((c) => (
                  <div
                    className={css`
                      margin-top: 26px;
                      padding: 20px 24px;

                      display: flex;
                      flex-direction: row;
                      border: 1.5px solid rgba(190, 190, 190, 0.5);
                      width: 347px;
                    `}
                    key={c.id}
                  >
                    <div
                      className={css`
                        height: 66px;
                        width: 66px;
                        background: #e6f4fb;
                        border-radius: 50%;
                      `}
                    ></div>
                    <div
                      className={css`
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        margin-left: 20px;
                      `}
                    >
                      {c.name}
                      <div
                        className={css`
                          font-size: 30px;
                          line-height: 30px;
                          padding-top: 8px;
                        `}
                      >
                        {roundDown(c.score_given, 2)}/
                        {c.score_total * getPointsList.data.users.length}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <BreakFromCentered sidebar={false}>
              <div
                className={css`
                  overflow: auto;
                `}
              >
                <table
                  className={css`
                    margin: 0 auto;
                    width: max-content;
                    margin-top: 67px;
                    border-spacing: 0 10px;
                    th:not(:first-child),
                    td {
                      padding-left: 30px;
                    }
                  `}
                >
                  <thead>
                    <tr
                      className={css`
                        text-align: left;
                        font-size: 13px;
                      `}
                    >
                      <th>
                        {t("serial-number")}{" "}
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

                      {getPointsList.data.chapter_points.map((c) => {
                        // eslint-disable-next-line i18next/no-literal-string
                        const courseSorting = `#ch${c.chapter_number}`
                        return (
                          <th key={c.id}>
                            {t("title-chapter-only-number", { "chapter-number": c.chapter_number })}{" "}
                            <a href={courseSorting} onClick={() => setSorting(courseSorting)}>
                              {DOWN_ARROW}
                            </a>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {getPointsList.data.users
                      .map((user) => {
                        const totalPoints = Object.values(
                          getPointsList.data.user_chapter_points[user.id] || {},
                        ).reduce((prev, curr) => prev + curr, 0)
                        const userChapterPoints =
                          getPointsList.data.user_chapter_points[user.id] || {}
                        const chapterPoints = Object.fromEntries(
                          getPointsList.data.chapter_points.map((c) => [
                            `ch${c.chapter_number}`,
                            userChapterPoints[c.id] || 0,
                          ]),
                        )
                        return { user, totalPoints, chapterPoints }
                      })
                      .sort(sortUsers)
                      .map(({ user, totalPoints }) => {
                        return (
                          <tr
                            className={css`
                              background: #ffffff;
                              td {
                                padding-top: 24px;
                                padding-bottom: 24px;
                                border-top: 1px solid rgba(190, 190, 190, 0.6);
                                border-bottom: 1px solid rgba(190, 190, 190, 0.6);
                                font-size: 16px;
                                line-height: 20px;
                              }
                              & :first-child {
                                padding-left: 24px;
                                border-left: 1px solid rgba(190, 190, 190, 0.6);
                              }
                              & :last-child {
                                padding-right: 24px;
                                border-right: 1px solid rgba(190, 190, 190, 0.6);
                              }
                            `}
                            key={user.id}
                          >
                            <td>{user.id}</td>
                            <td>
                              {user.first_name} {user.last_name}
                            </td>

                            <td>{user.email}</td>
                            <td>
                              {roundDown(totalPoints, 2)}/{instanceTotalPoints} (
                              {Math.round(totalPoints / instanceTotalPoints)}%)
                            </td>

                            {getPointsList.data.chapter_points.map((c) => {
                              const userChapterPoints =
                                getPointsList.data.user_chapter_points[user.id] || {}
                              const chapterPoints = userChapterPoints[c.id] || 0
                              return (
                                <td key={user.id + c.id}>
                                  {roundDown(chapterPoints, 2)}/{c.score_total}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </BreakFromCentered>
          </>
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseInstancePointsList)),
)
