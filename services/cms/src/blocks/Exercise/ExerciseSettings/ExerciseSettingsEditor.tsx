import { css } from "@emotion/css"
import { InnerBlocks } from "@wordpress/block-editor"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import PeerReviewEditor from "../../../components/PeerReviewEditor"
import ExerciseBlockContext from "../../../contexts/ExerciseBlockContext"
import PageContext from "../../../contexts/PageContext"

import Accordion from "@/shared-module/common/components/Accordion"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/list", "moocfi/latex"]

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
        <Accordion>
          <details>
            <summary>{t("peer-and-self-review-configuration")}</summary>
            <PeerReviewEditor
              attributes={attributes}
              setAttributes={setAttributes}
              exerciseId={attributes.id}
              courseId={courseId}
              courseGlobalEditor={false}
              instructionsEditor={
                <div
                  className={css`
                    border: 1px solid ${baseTheme.colors.gray[100]};
                    padding: 1rem;
                  `}
                >
                  <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} templateLock={false} />
                </div>
              }
            />
          </details>
        </Accordion>
      )}
    </div>
  )
}

export default ExerciseSettingsEditor
