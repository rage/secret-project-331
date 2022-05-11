import { css } from "@emotion/css"
import { t } from "i18next"
import { useState } from "react"
import { useQuery } from "react-query"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { fetchCourseReferences } from "../../../../../../services/backend/courses"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"

import NewReferenceDialog from "./NewReferenceDialog"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Cite = require("citation-js")

const TYPE = "string"
const STYLE = "vancouver"
const LANG = "en-US"
const BIBLIOGRAPHY = "bibliography"

const References: React.FC<CourseManagementPagesProps> = ({ courseId }) => {
  const [showNewReferenceModal, setShowNewReferenceModal] = useState(false)
  const getCourseReferences = useQuery(`course-${courseId}-references`, () =>
    fetchCourseReferences(courseId),
  )

  return (
    <div
      className={css`
        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      {getCourseReferences.isLoading && <Spinner variant="medium" />}
      {getCourseReferences.isError && (
        <ErrorBanner variant="readOnly" error={getCourseReferences.error} />
      )}
      {getCourseReferences.isSuccess && (
        <div>
          <h2>{t("references")}</h2>
          <Button variant="primary" size="medium" onClick={() => setShowNewReferenceModal(true)}>
            {t("add-new-reference")}
          </Button>
          <NewReferenceDialog
            onClose={() => setShowNewReferenceModal(false)}
            courseId={courseId}
            open={showNewReferenceModal}
            fetchCourseReferences={getCourseReferences}
          />
          <ul>
            {getCourseReferences.data.map((r, idx) => {
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
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default References
