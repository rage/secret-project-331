"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import type { UseMutationResult } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateMarketingConsent } from "@/generated/course-material-api/sdk.generated"
import type {
  CourseInstance,
  NewCourseBackgroundQuestionAnswer,
} from "@/generated/course-material-api/types.generated"
import useAdditionalQuestions from "@/hooks/course-material/useAdditionalQuestions"
import useCourse from "@/hooks/course-material/useCourse"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { baseTheme } from "@/shared-module/common/styles"
import { Button, Checkbox, Radio } from "@/shared-module/components"

import SelectMarketingConsentForm from "./SelectMarketingConsentForm"

const FieldContainer = styled.div`
  margin-bottom: 1.5rem;
`

const GreenText = styled.span`
  color: ${baseTheme.colors.green[700]};
`

const AdditionalQuestionWrapper = styled.div`
  margin: 0.5rem 0;
`

// oxlint-disable-next-line i18next/no-literal-string
const ANSWERS_FIELD = "answers" as const
// Wire format for NewCourseBackgroundQuestionAnswer.answer_value: "t"/"f" flags, not a boolean.
// oxlint-disable-next-line i18next/no-literal-string
const ANSWER_VALUE_TRUE = "t"
// oxlint-disable-next-line i18next/no-literal-string
const ANSWER_VALUE_FALSE = "f"

interface SelectCourseInstanceFormProps {
  courseInstances: CourseInstance[]
  submitMutation: UseMutationResult<
    unknown,
    unknown,
    {
      instanceId: string
      backgroundQuestionAnswers: NewCourseBackgroundQuestionAnswer[]
    },
    unknown
  >
  initialSelectedInstanceId?: string
  dialogLanguage: string
  selectedLangCourseId: string
}

interface AdditionalQuestionAnswerFormValue {
  course_background_question_id: string
  answer_value: boolean
}

interface SelectCourseInstanceFormValues {
  courseInstanceId: string | undefined
  answers: AdditionalQuestionAnswerFormValue[]
}

const SelectCourseInstanceForm: React.FC<
  React.PropsWithChildren<SelectCourseInstanceFormProps>
> = ({
  courseInstances,
  submitMutation,
  initialSelectedInstanceId,
  dialogLanguage,
  selectedLangCourseId,
}) => {
  const { t } = useTranslation("main-frontend", { lng: dialogLanguage })
  const { control, watch, setValue, getValues } = useForm<SelectCourseInstanceFormValues>({
    defaultValues: {
      courseInstanceId: figureOutInitialValue(courseInstances, initialSelectedInstanceId),
      answers: [],
    },
  })
  const { fields: answerFields, replace: replaceAnswers } = useFieldArray({
    control,
    name: ANSWERS_FIELD,
  })
  const courseInstanceId = watch("courseInstanceId")

  const [isMarketingConsentChecked, setIsMarketingConsentChecked] = useState(false)
  const [isEmailSubscriptionConsentChecked, setIsEmailSubscriptionConsentChecked] = useState(false)

  const additionalQuestionsQuery = useAdditionalQuestions(courseInstanceId)
  const getCourse = useCourse(selectedLangCourseId)

  useEffect(() => {
    if (!additionalQuestionsQuery.data) {
      return
    }
    // Populates initial answers for all questions, preserving any answer already entered.
    const prevAnswers = getValues(ANSWERS_FIELD)
    const nextAnswers: AdditionalQuestionAnswerFormValue[] =
      additionalQuestionsQuery.data.background_questions.map((question) => {
        const prevAnswer = prevAnswers.find((a) => a.course_background_question_id === question.id)
        const savedAnswer = additionalQuestionsQuery.data.answers.find(
          (a) => a.course_background_question_id === question.id,
        )
        return {
          course_background_question_id: question.id,
          answer_value: prevAnswer?.answer_value ?? savedAnswer?.answer_value === ANSWER_VALUE_TRUE,
        }
      })
    replaceAnswers(nextAnswers)
  }, [additionalQuestionsQuery.data, getValues, replaceAnswers])

  useEffect(() => {
    if (courseInstances.some((x) => x.id === courseInstanceId)) {
      // Selected course instance is an allowed option
      return
    }

    setValue("courseInstanceId", figureOutInitialValue(courseInstances, initialSelectedInstanceId))
  }, [courseInstances, initialSelectedInstanceId, courseInstanceId, setValue])

  const enrollOnCourse = async () => {
    if (courseInstanceId) {
      submitMutation.mutate({
        instanceId: courseInstanceId,
        backgroundQuestionAnswers: getValues(ANSWERS_FIELD).map((answer) => ({
          course_background_question_id: answer.course_background_question_id,
          answer_value: answer.answer_value ? ANSWER_VALUE_TRUE : ANSWER_VALUE_FALSE,
        })),
      })
    }
    if (getCourse.isSuccess && getCourse.data?.ask_marketing_consent) {
      await updateMarketingConsent({
        body: {
          course_language_groups_id: getCourse.data.course_language_group_id,
          email_subscription: isEmailSubscriptionConsentChecked,
          marketing_consent: isMarketingConsentChecked,
        },
        path: {
          course_id: getCourse.data.id,
        },
      })
    }
  }

  const additionalQuestions = additionalQuestionsQuery.data?.background_questions

  return (
    <div>
      <h2 data-testid="select-course-instance-heading">
        {t("title-select-course-instance")}
        <GreenText>*</GreenText>
      </h2>
      <FieldContainer role="radiogroup" aria-label={t("label-course-instance")} aria-required>
        {courseInstances.map((courseInstance) => (
          <div key={courseInstance.id}>
            <Radio
              className={css`
                span {
                  font-weight: 500;
                }
              `}
              key={courseInstance.id}
              {...(courseInstance.name === null
                ? // oxlint-disable-next-line i18next/no-literal-string
                  { "data-testid": "default-course-instance-radiobutton" }
                : undefined)}
              label={courseInstance.name || t("default-course-instance-name")}
              name="select-course-instance"
              value={courseInstance.id}
              checked={courseInstanceId === courseInstance.id}
              onChange={() => setValue("courseInstanceId", courseInstance.id)}
            />
            <span
              className={css`
                font-size: 15px;
                display: flex;
                margin-top: -0.4rem;
              `}
            >
              {courseInstance.description}
            </span>
          </div>
        ))}
      </FieldContainer>
      <div
        className={css`
          margin-top: 1rem;
          margin-bottom: 1rem;
          color: ${baseTheme.colors.gray[600]};
        `}
      >
        <GreenText>*</GreenText> {t("select-course-instance-explanation")}
      </div>
      {courseInstanceId !== undefined && additionalQuestions && additionalQuestions.length > 0 && (
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          <h2>{t("title-additional-questions")}</h2>
          {additionalQuestions.map((additionalQuestion, index) => {
            const fieldId = answerFields[index]?.id ?? additionalQuestion.id
            if (additionalQuestion.question_type === "Checkbox") {
              return (
                <AdditionalQuestionWrapper key={fieldId}>
                  <Checkbox
                    name={`${ANSWERS_FIELD}.${index}.answer_value`}
                    control={control}
                    label={additionalQuestion.question_text}
                  />
                </AdditionalQuestionWrapper>
              )
            }
            return (
              <AdditionalQuestionWrapper key={fieldId}>
                {t("unsupported-question-type")}
              </AdditionalQuestionWrapper>
            )
          })}
        </div>
      )}
      {additionalQuestionsQuery.error && (
        <ErrorBanner variant="readOnly" error={additionalQuestionsQuery.error} />
      )}
      {getCourse.data?.ask_marketing_consent && (
        <div>
          <SelectMarketingConsentForm
            courseId={selectedLangCourseId}
            dialogLanguage={dialogLanguage}
            onEmailSubscriptionConsentChange={setIsEmailSubscriptionConsentChecked}
            onMarketingConsentChange={setIsMarketingConsentChecked}
          />
        </div>
      )}
      <div>
        <Button
          size="medium"
          variant="primary"
          onClick={enrollOnCourse}
          disabled={Boolean(
            !courseInstanceId ||
            additionalQuestionsQuery.isLoading ||
            (getCourse.data?.ask_marketing_consent && !isEmailSubscriptionConsentChecked),
          )}
          data-testid="select-course-instance-continue-button"
        >
          {t("continue")}
        </Button>
      </div>
    </div>
  )
}

function figureOutInitialValue(
  instances: CourseInstance[],
  initialSelectedInstanceId: string | undefined,
): string | undefined {
  if (initialSelectedInstanceId && instances.some((x) => x.id === initialSelectedInstanceId)) {
    return initialSelectedInstanceId
  }
  if (instances.length === 1) {
    return instances[0]?.id
  }
  return undefined
}

export default SelectCourseInstanceForm
