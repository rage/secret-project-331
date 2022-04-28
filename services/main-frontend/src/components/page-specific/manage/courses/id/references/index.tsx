import { css } from "@emotion/css"
import Cite from "citation-js"
import { t } from "i18next"
import { useState } from "react"
import { useQuery } from "react-query"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { fetchCourseReferences } from "../../../../../../services/backend/courses"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"

import NewReferenceModal from "./NewReferenceModal"

const FORMAT = "text"
const TEMPLATE = "vancouver"
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
          <h2>References</h2>
          <Button variant="primary" size="medium" onClick={() => setShowNewReferenceModal(true)}>
            {t("add-new-reference")}
          </Button>
          <NewReferenceModal
            onClose={() => setShowNewReferenceModal(false)}
            courseId={courseId}
            open={showNewReferenceModal}
          />
          <ul>
            {getCourseReferences.data.map((r, idx) => {
              const c = Cite(r)
              return (
                <li key={idx}>
                  {c.format(BIBLIOGRAPHY, {
                    format: FORMAT,
                    template: TEMPLATE,
                    lang: LANG,
                  })}
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
