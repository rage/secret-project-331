import { css } from "@emotion/css"
import React, { useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import { getPoints } from "../../../../services/backend/course-instances"
import { User } from "../../../../shared-module/bindings"
import { isErrorResponse } from "../../../../shared-module/bindings.guard"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface PointListProps {
  query: SimplifiedUrlQuery<"id">
}

interface ProcessedUser {
  user: User
  totalPoints: number
  chapterPoints: Record<string, number>
}

const PointList: React.FC<PointListProps> = ({ query }) => {
  const courseInstanceId = query.id

  const [sorting, setSorting] = useState("name")

  function sortUsers(first: ProcessedUser, second: ProcessedUser): number {
    if (sorting == "name") {
      return first.user.email.localeCompare(second.user.email)
    } else if (sorting == "number") {
      return first.user.id.localeCompare(second.user.id)
    } else if (sorting == "score") {
      return first.totalPoints - second.totalPoints
    } else if (sorting == "email") {
      return first.user.email.localeCompare(second.user.email)
    } else {
      return first.chapterPoints[sorting] - second.chapterPoints[sorting]
    }
  }

  const { isLoading, error, data } = useQuery(`point-list-${courseInstanceId}`, () =>
    getPoints(courseInstanceId),
  )

  if (error) {
    let message
    if (isErrorResponse(error)) {
      message = `Failed to fetch points: ${error.message}`
    } else {
      message = `Unexpected error while fetching points: ${JSON.stringify(error)}`
    }
    return (
      <div>
        <h1>Error</h1>
        <pre>{message}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>Loading page...</div>
  }

  const instanceTotalPoints = data.chapter_points.reduce((prev, curr) => prev + curr.score_total, 0)

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
          color: #707070;
          font-weight: 600;
          font-family: Josefin Sans;

          padding: 51px 24px;
          @media (min-width: 768px) {
            padding: 149px 82px 127px 155px;
          }
        `}
      >
        <h2
          className={css`
            font-size: 45px;
            line-height: 45px;
          `}
        >
          Point Summary: {courseInstanceId}
        </h2>
        <div
          className={css`
            margin-top: 51px;
            padding: 44px 57px 49px 57px;

            background: #ffffff;
            border: 1px solid rgba(190, 190, 190, 0.6);
          `}
        >
          <h3>TOTAL POINT DASHBOARD</h3>
          <div
            className={css`
              margin-top: 22px;

              font-size: 22px;
              line-height: 22px;
              opacity: 0.8;
            `}
          >
            Number Of Students: {data.users.length}
          </div>
          <div
            className={css`
              column-gap: 36px;
              display: flex;
              flex-direction: row;
              flex-wrap: wrap;
            `}
          >
            {data.chapter_points.map((c) => (
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
                  <div
                    className={css`
                      opacity: 0.7;
                    `}
                  >
                    {c.name}
                  </div>
                  <div
                    className={css`
                      font-size: 30px;
                      line-height: 30px;
                      padding-top: 8px;
                    `}
                  >
                    {c.score_given}/{c.score_total}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={css`
            overflow: auto;
          `}
        >
          <table
            className={css`
              margin-top: 67px;
              border-spacing: 0 10px;
              th:not(:first-child),
              td {
                padding-left: 61px;
              }
            `}
          >
            <thead>
              <tr
                className={css`
                  text-align: left;
                  opacity: 0.8;
                `}
              >
                <th>
                  Student name{" "}
                  <a href="#name" onClick={() => setSorting("name")}>
                    v
                  </a>
                </th>
                <th>
                  Serial number{" "}
                  <a href="#number" onClick={() => setSorting("number")}>
                    v
                  </a>
                </th>
                <th>
                  Score{" "}
                  <a href="#score" onClick={() => setSorting("score")}>
                    v
                  </a>
                </th>
                <th>
                  Email{" "}
                  <a href="#email" onClick={() => setSorting("email")}>
                    v
                  </a>
                </th>
                {data.chapter_points.map((c) => {
                  const courseSorting = `#ch${c.chapter_number}`
                  return (
                    <th key={c.id}>
                      {c.name}{" "}
                      <a href={courseSorting} onClick={() => setSorting(courseSorting)}>
                        v
                      </a>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {data.users
                .map((user) => {
                  const totalPoints = Object.values(data.user_chapter_points[user.id]).reduce(
                    (prev, curr) => prev + curr,
                    0,
                  )
                  const userChapterPoints = data.user_chapter_points[user.id]
                  const chapterPoints = Object.fromEntries(
                    data.chapter_points.map((c) => [
                      `ch${c.chapter_number}`,
                      userChapterPoints[c.id],
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
                          font-size: 20px;
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
                      <td>{user.email}</td>
                      <td>{user.id}</td>
                      <td>
                        {totalPoints}/{instanceTotalPoints} (
                        {Math.round(totalPoints / instanceTotalPoints)}%)
                      </td>
                      <td>{user.email}</td>
                      {data.chapter_points.map((c) => {
                        const userChapterPoints = data.user_chapter_points[user.id]
                        const chapterPoints = userChapterPoints[c.id]
                        return (
                          <td key={user.id + c.id}>
                            {chapterPoints || 0}/{c.score_total}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(PointList)))
