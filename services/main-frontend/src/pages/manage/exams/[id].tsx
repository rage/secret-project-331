import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "react-query"

import Layout from "../../../components/Layout"
import { fetchExam, setCourse, unsetCourse } from "../../../services/backend/exams"
import { ErrorResponse } from "../../../shared-module/bindings"
import { isErrorResponse } from "../../../shared-module/bindings.guard"
import { frontendWideWidthCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

interface OrganizationPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Organization: React.FC<OrganizationPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const { isLoading, isError, error, data, refetch } = useQuery(`exam-${query.id}`, () =>
    fetchExam(query.id),
  )
  const [newCourse, setNewCourse] = useState("")
  const [errorResponse, setErrorResponse] = useState<ErrorResponse | null>(null)
  const setCourseMutation = useMutation(
    ({ examId, courseId }: { examId: string; courseId: string }) => {
      setErrorResponse(null)
      return setCourse(examId, courseId)
    },
    {
      onSuccess: (data) => {
        if (isErrorResponse(data)) {
          setErrorResponse(data)
        } else {
          refetch()
        }
      },
    },
  )
  const unsetCourseMutation = useMutation(
    ({ examId, courseId }: { examId: string; courseId: string }) => {
      setErrorResponse(null)
      return unsetCourse(examId, courseId)
    },
    {
      onSuccess: (data) => {
        if (isErrorResponse(data)) {
          setErrorResponse(data)
        } else {
          refetch()
        }
      },
    },
  )

  let content = null
  if (isLoading || !data) {
    content = <div>{t("loading-text")}</div>
  } else if (isError) {
    content = <div>{JSON.stringify(error, undefined, 2)}</div>
  } else if (isErrorResponse(data)) {
    content = (
      <>
        <div>{t("error-title")}</div>
        <div>{data.title}</div>
        <div>{data.message}</div>
        <div>{data.source || ""}</div>
      </>
    )
  } else {
    content = (
      <>
        <h1>
          {data.name} {data.id}
        </h1>
        <div>
          <a href={`/cms/pages/${data.page_id}`}>{t("manage-page")}</a> ({data.page_id})
        </div>
        <h2>{t("courses")}</h2>
        {data.courses.map((c) => (
          <div key={c.id}>
            <a href={`/manage/courses/${c.id}`}>{c.name}</a> ({c.id}){" "}
            <button
              onClick={() => {
                unsetCourseMutation.mutate({ examId: data.id, courseId: c.id })
              }}
            >
              {t("button-text-remove")}
            </button>
          </div>
        ))}
        <label htmlFor={"input"}>{t("add-course")}:</label>
        <input
          id={"input"}
          placeholder={t("course-id")}
          value={newCourse}
          onChange={(ev) => setNewCourse(ev.target.value)}
        />
        <button
          onClick={() => {
            setCourseMutation.mutate({ examId: data.id, courseId: newCourse })
            setNewCourse("")
          }}
        >
          {t("add-course")}
        </button>
        {errorResponse && <div>{JSON.stringify(errorResponse, undefined, 2)}</div>}
      </>
    )
  }

  return (
    <Layout frontPageUrl={"/"} navVariant={"complex"}>
      <div
        className={css`
          ${frontendWideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        {content}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(Organization))
