import { css } from "@emotion/css"
import { compareDesc } from "date-fns"
import React, { useState } from "react"
import { useQuery } from "react-query"

import FeedbackView from "../../../../components/FeedbackView"
import Layout from "../../../../components/Layout"
import { fetchFeedback } from "../../../../services/backend/feedback"
import { Feedback } from "../../../../shared-module/bindings"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface FeedbackProps {
  query: SimplifiedUrlQuery<"id">
}

const FeedbackPage: React.FC<FeedbackProps> = ({ query }) => {
  const courseId = query.id
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const { isLoading, error } = useQuery(`feedback-list-${courseId}`, () =>
    fetchFeedback(courseId).then((data) =>
      setFeedback(data.sort((a, b) => compareDesc(a.created_at, b.created_at))),
    ),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !feedback) {
    return <>Loading...</>
  }

  console.log(feedback)

  return (
    <Layout>
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>Feedback</h1>
        <h2>Unread</h2>
        <ul>
          {feedback
            .filter((f) => !f.marked_as_read)
            .map((f) => {
              return (
                <li key={f.id}>
                  <FeedbackView
                    feedback={f}
                    setRead={(read) =>
                      setFeedback((list) => {
                        list.find((item) => item.id === f.id).marked_as_read = read
                        return [...list]
                      })
                    }
                  />
                </li>
              )
            })}
        </ul>
        <h2>Read</h2>
        <ul>
          {feedback
            .filter((f) => f.marked_as_read)
            .map((f) => {
              return (
                <li key={f.id}>
                  <FeedbackView
                    feedback={f}
                    setRead={(read) =>
                      setFeedback((list) => {
                        list.find((item) => item.id === f.id).marked_as_read = read
                        return [...list]
                      })
                    }
                  />
                </li>
              )
            })}
        </ul>
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(FeedbackPage)))
