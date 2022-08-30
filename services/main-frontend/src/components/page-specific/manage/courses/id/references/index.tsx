import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { fetchCourseReferences } from "../../../../../../services/backend/courses"
import { MaterialReference } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { baseTheme, headingFont } from "../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"

import EditReferenceDialog from "./EditReferenceDialog"
import NewReferenceDialog from "./NewReferenceDialog"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Cite = require("citation-js")

const TYPE = "string"
const STYLE = "vancouver"
const LANG = "en-US"
const BIBLIOGRAPHY = "bibliography"

const ErrorHeader = styled.h5`
  color: red;
`

const References: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [showNewReferenceModal, setShowNewReferenceModal] = useState(false)
  const [showEditReferenceModal, setShowEditReferenceModal] = useState(false)
  const [reference, setReference] = useState<MaterialReference | null>(null)
  const getCourseReferences = useQuery([`course-${courseId}-references`], () =>
    fetchCourseReferences(courseId),
  )

  return (
    <div>
      {getCourseReferences.isLoading && (
        <div
          className={css`
            margin-top: 40px;
            ${respondToOrLarger.sm} {
              margin-top: 80px;
            }
          `}
        >
          <Spinner variant="medium" />
        </div>
      )}
      {getCourseReferences.isError && (
        <div
          className={css`
            margin-top: 40px;
            ${respondToOrLarger.sm} {
              margin-top: 80px;
            }
          `}
        >
          <ErrorBanner variant="readOnly" error={getCourseReferences.error} />
        </div>
      )}
      {getCourseReferences.isSuccess && (
        <div>
          <h2
            className={css`
              font-size: clamp(2rem, 3.6vh, 36px);
              color: ${baseTheme.colors.grey[700]};
              font-family: ${headingFont};
              font-weight: bold;
            `}
          >
            {t("references")}
          </h2>
          {getCourseReferences.data.length > 10 && (
            <Button variant="primary" size="medium" onClick={() => setShowNewReferenceModal(true)}>
              {t("add-new-reference")}
            </Button>
          )}
          <NewReferenceDialog
            onClose={() => setShowNewReferenceModal(false)}
            courseId={courseId}
            open={showNewReferenceModal}
            fetchCourseReferences={getCourseReferences}
          />
          <ul>
            {getCourseReferences.data
              .sort((o1, o2) => o1.citation_key.localeCompare(o2.citation_key))
              .map((r, idx) => {
                try {
                  const c = Cite(r.reference)

                  return (
                    <li key={idx}>
                      <h5>
                        {r.citation_key},{" "}
                        {c.format(BIBLIOGRAPHY, {
                          type: TYPE,
                          style: STYLE,
                          lang: LANG,
                        })}
                      </h5>
                      <Button
                        size="medium"
                        variant="secondary"
                        onClick={() => {
                          setReference(r)
                          setShowEditReferenceModal(true)
                        }}
                      >
                        {t("edit-reference")}
                      </Button>
                    </li>
                  )
                } catch (error) {
                  return (
                    <li key={idx}>
                      <ErrorHeader>{r.citation_key}</ErrorHeader>
                      <Button
                        size="medium"
                        variant="secondary"
                        onClick={() => {
                          setReference(r)
                          setShowEditReferenceModal(true)
                        }}
                      >
                        {t("edit-reference")}
                      </Button>
                    </li>
                  )
                }
              })}
          </ul>
          {reference && (
            <EditReferenceDialog
              courseId={courseId}
              getCourseReferences={getCourseReferences}
              onClose={() => setShowEditReferenceModal(false)}
              reference={reference}
              open={showEditReferenceModal}
            />
          )}
        </div>
      )}
      <Button variant="primary" size="medium" onClick={() => setShowNewReferenceModal(true)}>
        {t("add-new-reference")}
      </Button>
    </div>
  )
}

export default References
