import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { UseMutationResult, useQuery } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { fetchBackgroundQuestionsAndAnswers } from "../../services/backend"
import {
  CourseInstance,
  NewCourseBackgroundQuestionAnswer,
} from "../../shared-module/common/bindings"
import Button from "../../shared-module/common/components/Button"
import ErrorBanner from "../../shared-module/common/components/ErrorBanner"
import CheckBox from "../../shared-module/common/components/InputFields/CheckBox"
import RadioButton from "../../shared-module/common/components/InputFields/RadioButton"
import { baseTheme } from "../../shared-module/common/styles"
import { assertNotNullOrUndefined } from "../../shared-module/common/utils/nullability"

const FieldContainer = styled.div`
  margin-bottom: 1.5rem;
`

// eslint-disable-next-line i18next/no-literal-string
const GreenText = styled.span`
  color: ${baseTheme.colors.green[700]};
`

const AdditionalQuestionWrapper = styled.div`
  margin: 0.5rem 0;
`

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
  languageChanged: boolean
}

const SelectCourseInstanceForm: React.FC<
  React.PropsWithChildren<SelectCourseInstanceFormProps>
> = ({ courseInstances, submitMutation, initialSelectedInstanceId, languageChanged }) => {
  const { t } = useTranslation()
  const [instance, setInstance] = useState(
    figureOutInitialValue(courseInstances, initialSelectedInstanceId),
  )
  const [additionalQuestionAnswers, setAdditionalQuestionAnswers] = useState<
    NewCourseBackgroundQuestionAnswer[]
  >([])
  const additionalQuestionsQuery = useQuery({
    queryKey: ["additional-questions", instance],
    queryFn: () => fetchBackgroundQuestionsAndAnswers(assertNotNullOrUndefined(instance)),
    enabled: instance !== undefined,
  })

  useEffect(() => {
    if (!additionalQuestionsQuery.data) {
      return
    }
    // Populates initial answers for all questions
    setAdditionalQuestionAnswers((prev) => {
      const newState: NewCourseBackgroundQuestionAnswer[] = []
      additionalQuestionsQuery.data.background_questions.forEach((question) => {
        const prevAnswer = prev.find((a) => a.course_background_question_id === question.id)
        const savedAnswer = additionalQuestionsQuery.data.answers.find(
          (a) => a.course_background_question_id === question.id,
        )
        let initialValue = prevAnswer?.answer_value ?? savedAnswer?.answer_value ?? null
        if (question.question_type === "Checkbox" && initialValue === null) {
          initialValue = "f"
        }
        newState.push({
          answer_value: initialValue,
          course_background_question_id: question.id,
        })
      })
      return newState
    })
  }, [additionalQuestionsQuery.data])

  useEffect(() => {
    if (languageChanged) {
      setInstance(undefined) // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [languageChanged])

  const enrollOnCourse = async () => {
    if (instance) {
      submitMutation.mutate({
        instanceId: instance,
        backgroundQuestionAnswers: additionalQuestionAnswers,
      })
    }
  }

  const additionalQuestions = additionalQuestionsQuery.data?.background_questions

  return (
    <div>
      <>
        <h2 data-testid="select-course-instance-heading">
          {t("title-select-course-instance")}
          <GreenText>*</GreenText>
        </h2>
        <FieldContainer
          role="radiogroup"
          aria-label={t("label-course-instance")}
          // eslint-disable-next-line i18next/no-literal-string
          aria-required="true"
        >
          {courseInstances.map((x) => (
            <RadioButton
              key={x.id}
              {...(x.name === null
                ? // eslint-disable-next-line i18next/no-literal-string
                  { "data-testid": "default-course-instance-radiobutton" }
                : undefined)}
              label={x.name || t("default-course-instance-name")}
              onChange={(_event) => setInstance(x.id)}
              defaultChecked={instance === x.id}
              // eslint-disable-next-line i18next/no-literal-string
              name="select-course-instance"
            />
          ))}
        </FieldContainer>
        <div
          className={css`
            margin-top: -0.5rem;
            margin-bottom: 1rem;
            color: ${baseTheme.colors.gray[600]};
          `}
        >
          <GreenText>*</GreenText> {t("select-course-instance-explanation")}
        </div>
        {instance !== undefined && additionalQuestions && additionalQuestions.length > 0 && (
          <div
            className={css`
              margin-bottom: 1rem;
            `}
          >
            <>
              <h2>{t("title-additional-questions")}</h2>
              {additionalQuestions.map((additionalQuestion) => {
                if (additionalQuestion.question_type === "Checkbox") {
                  const answer = additionalQuestionAnswers.find(
                    (a) => a.course_background_question_id === additionalQuestion.id,
                  )
                  return (
                    <AdditionalQuestionWrapper key={additionalQuestion.id}>
                      <CheckBox
                        label={additionalQuestion.question_text}
                        checked={answer?.answer_value === "t"}
                        onChange={(event) => {
                          // eslint-disable-next-line i18next/no-literal-string
                          const valueAsString = event.target.value ? "t" : "f"
                          setAdditionalQuestionAnswers((prev) => {
                            const newArray = prev.filter(
                              (a) => a.course_background_question_id !== additionalQuestion.id,
                            )
                            newArray.push({
                              answer_value: valueAsString,
                              course_background_question_id: additionalQuestion.id,
                            })
                            return newArray
                          })
                        }}
                      />
                    </AdditionalQuestionWrapper>
                  )
                }
                return (
                  <AdditionalQuestionWrapper key={additionalQuestion.id}>
                    {t("unsupported-question-type")}
                  </AdditionalQuestionWrapper>
                )
              })}
            </>
          </div>
        )}
        {additionalQuestionsQuery.error && <ErrorBanner error={additionalQuestionsQuery.error} />}
        <div>
          <Button
            size="medium"
            variant="primary"
            onClick={enrollOnCourse}
            disabled={!instance || additionalQuestionsQuery.isPending}
            data-testid="select-course-instance-continue-button"
          >
            {t("continue")}
          </Button>
        </div>
      </>
    </div>
  )
}

function figureOutInitialValue(
  items: CourseInstance[],
  initialSelectedInstanceId: string | undefined,
): string | undefined {
  if (initialSelectedInstanceId) {
    return initialSelectedInstanceId
  }
  if (items.length === 1) {
    return items[0].id
  }
}

export default SelectCourseInstanceForm
