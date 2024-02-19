import { css } from "@emotion/css"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import PeerReviewEditor from "../../../components/PeerReviewEditor"
import ExerciseBlockContext from "../../../contexts/ExerciseBlockContext"
import PageContext from "../../../contexts/PageContext"
import Accordion from "../../../shared-module/components/Accordion"
import CheckBox from "../../../shared-module/components/InputFields/CheckBox"
import TextField from "../../../shared-module/components/InputFields/TextField"
import { baseTheme } from "../../../shared-module/styles"
import { respondToOrLarger } from "../../../shared-module/styles/respond"

const ExerciseSettingsEditor = () => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id
  const { attributes, setAttributes } = useContext(ExerciseBlockContext)

  if (!attributes) {
    return null
  }

  return (
    <div
      className={css`
        background-color: white;
        border: 1px solid ${baseTheme.colors.clear[100]};
        border-radius: 2px;
        padding: 1rem 2rem;
        margin-bottom: 1rem;
      `}
    >
      <TextField
        label={t("exercise-name")}
        placeholder={t("exercise-name")}
        value={attributes.name}
        onChangeByValue={(value) => setAttributes({ name: value })}
        className={css`
          margin-bottom: 1rem !important;
        `}
      />
      <TextField
        label={t("exercise-max-points")}
        placeholder={t("exercise-max-points")}
        value={attributes.score_maximum?.toString() ?? ""}
        type="number"
        onChangeByValue={(value) => {
          const parsed = parseInt(value)
          if (isNaN(parsed)) {
            // empty
            setAttributes({ score_maximum: undefined })
            return
          }
          setAttributes({ score_maximum: parsed })
        }}
        className={css`
          margin-bottom: 1rem !important;
        `}
      />
      <div
        className={css`
          display: flex;
          flex-direction: column;
          margin-bottom: 1rem;
          ${respondToOrLarger.md} {
            align-items: center;
            flex-direction: row;
          }
        `}
      >
        <CheckBox
          label={t("limit-number-of-tries")}
          checked={attributes.limit_number_of_tries}
          onChangeByValue={function (checked: boolean): void {
            setAttributes({ limit_number_of_tries: checked })
          }}
          className={css`
            flex: 1;
            padding-top: 1.3rem;
          `}
        />
        <TextField
          label={t("tries-per-slide")}
          placeholder={t("tries-per-slide")}
          value={attributes.max_tries_per_slide?.toString() ?? ""}
          disabled={!attributes.limit_number_of_tries}
          type="number"
          onChangeByValue={(value) => {
            const parsed = parseInt(value)
            if (isNaN(parsed)) {
              // empty
              setAttributes({ max_tries_per_slide: undefined })
              return
            }
            setAttributes({ max_tries_per_slide: parsed })
          }}
          className={css`
            flex: 1;
          `}
        />
      </div>
      {courseId && (
        <Accordion variant="detail">
          <details>
            <summary>{t("peer-and-self-review-configuration")}</summary>
            <PeerReviewEditor
              attributes={attributes}
              setAttributes={setAttributes}
              exerciseId={attributes.id}
              courseId={courseId}
              courseGlobalEditor={false}
            />
          </details>
        </Accordion>
      )}
    </div>
  )
}

export default ExerciseSettingsEditor
