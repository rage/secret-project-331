"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import React, { useContext } from "react"
import { useWatch } from "react-hook-form"

import type { ExerciseAttributes } from "@/blocks/Exercise"
import { getCmsCourseOptions } from "@/generated/api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Checkbox, Disclosure, TextField } from "@/shared-module/components"
import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useAttributeForm } from "@/utils/useAttributeForm"
import { useTranslation } from "@/utils/useCmsTranslation"

import PeerReviewEditor from "../../../components/PeerReviewEditor"
import ExerciseBlockContext from "../../../contexts/ExerciseBlockContext"
import PageContext from "../../../contexts/PageContext"

interface SettingsValues {
  name: string
  scoreMaximum: string
  limitNumberOfTries: boolean
  maxTriesPerSlide: string
  teacherReviewsAnswerAfterLocking: boolean
}

const parseOptionalInt = (value: string): number | undefined => {
  // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt intended; Number() differs
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? undefined : parsed
}

interface SettingsFieldsProps {
  attributes: ExerciseAttributes
  setAttributes: (attributes: Partial<ExerciseAttributes>) => void
  showTeacherReview: boolean
}

const SettingsFields: React.FC<SettingsFieldsProps> = ({
  attributes,
  setAttributes,
  showTeacherReview,
}) => {
  const { t } = useTranslation()
  const { control } = useAttributeForm<SettingsValues>(
    {
      name: attributes.name,
      scoreMaximum: attributes.score_maximum?.toString() ?? "",
      limitNumberOfTries: Boolean(attributes.limit_number_of_tries),
      maxTriesPerSlide: attributes.max_tries_per_slide?.toString() ?? "",
      teacherReviewsAnswerAfterLocking: attributes.teacher_reviews_answer_after_locking ?? true,
    },
    (values, changedName) => {
      switch (changedName) {
        case "name":
          setAttributes({ name: values.name })
          break
        case "scoreMaximum":
          // @ts-expect-error -- score_maximum is required on ExerciseAttributes (used in API payloads); resetting to undefined at runtime is intentional
          setAttributes({ score_maximum: parseOptionalInt(values.scoreMaximum) })
          break
        case "limitNumberOfTries":
          setAttributes({ limit_number_of_tries: values.limitNumberOfTries })
          break
        case "maxTriesPerSlide":
          setAttributes({ max_tries_per_slide: parseOptionalInt(values.maxTriesPerSlide) })
          break
        case "teacherReviewsAnswerAfterLocking":
          setAttributes({
            teacher_reviews_answer_after_locking: values.teacherReviewsAnswerAfterLocking,
          })
          break
      }
    },
  )
  const limitNumberOfTries = useWatch({ control, name: "limitNumberOfTries" })

  return (
    <>
      <TextField
        name="name"
        control={control}
        label={t("exercise-name")}
        className={css`
          margin-bottom: 1rem !important;
        `}
      />
      <TextField
        name="scoreMaximum"
        control={control}
        label={t("exercise-max-points")}
        type="number"
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
        <Checkbox
          name="limitNumberOfTries"
          control={control}
          label={t("limit-number-of-tries")}
          className={css`
            flex: 1;
            padding-top: 0.4rem;
          `}
        />
        <TextField
          name="maxTriesPerSlide"
          control={control}
          label={t("tries-per-slide")}
          isDisabled={!limitNumberOfTries}
          type="number"
          className={css`
            flex: 1;
          `}
        />
      </div>
      {showTeacherReview && (
        <Checkbox
          name="teacherReviewsAnswerAfterLocking"
          control={control}
          label={t("teacher-reviews-answer-after-locking")}
          className={css`
            margin-bottom: 1rem;
          `}
        />
      )}
    </>
  )
}

const ExerciseSettingsEditor: React.FC<BlockEditProps> = ({ name }) => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id
  const { attributes, setAttributes } = useContext(ExerciseBlockContext)

  const courseQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCmsCourseOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )
  const chapterLockingEnabled = courseQuery.data?.chapter_locking_enabled ?? false
  const blockProps = useBlockProps({
    className: css`
      background-color: white;
      border: 1px solid ${baseTheme.colors.clear[100]};
      border-radius: 2px;
      padding: 1rem 2rem;
      margin-bottom: 1rem;
    `,
  })

  if (!attributes) {
    // Still renders the wrapper: a block without one cannot be selected or removed in the editor.
    return <div {...blockProps} />
  }

  return (
    <div {...blockProps}>
      <SettingsFields
        attributes={attributes}
        setAttributes={setAttributes}
        showTeacherReview={Boolean(courseId && chapterLockingEnabled)}
      />
      {courseId && (
        <Disclosure title={t("peer-and-self-review-configuration")}>
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
                <InnerBlocks {...registeredInnerBlocksProps(name)} />
              </div>
            }
          />
        </Disclosure>
      )}
    </div>
  )
}

export default ExerciseSettingsEditor
