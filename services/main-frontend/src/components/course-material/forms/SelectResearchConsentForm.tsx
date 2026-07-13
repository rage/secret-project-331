"use client"

import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "../ContentRenderer"

import { CheckboxContext } from "@/contexts/course-material/CheckboxContext"
import {
  getCourseMaterialResearchConsentFormQuestions,
  postCourseMaterialResearchConsentFormAnswer,
} from "@/generated/course-material-api/sdk.generated"
import type {
  ResearchForm,
  ResearchFormQuestion,
  ResearchFormQuestionAnswer,
} from "@/generated/course-material-api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import useUserInfo from "@/shared-module/common/hooks/useUserInfo"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { currentCourseIdAtom, materialCourseAtom } from "@/state/course-material/selectors"
import type { Block } from "@/types/courseMaterialBlock"

interface ResearchConsentFormProps {
  onClose: () => void
  editForm: boolean
  shouldAnswerResearchForm: boolean
  usersInitialAnswers?: ResearchFormQuestionAnswer[]
  researchForm: ResearchForm
}

interface UserAnswer {
  questionId: string
  answer: boolean
}

const SelectResearchConsentForm: React.FC<React.PropsWithChildren<ResearchConsentFormProps>> = ({
  editForm,
  onClose,
  shouldAnswerResearchForm,
  usersInitialAnswers,
  researchForm,
}) => {
  const { t } = useTranslation()
  const userId = useUserInfo().data?.user_id
  const courseId = useAtomValue(currentCourseIdAtom)
  const courseName = useAtomValue(materialCourseAtom)?.name

  const [questionIdsAndAnswers, setQuestionIdsAndAnswers] = useState<Record<string, boolean>>()
  const getResearchFormQuestions = useQuery({
    queryKey: ["course-material-research-consent-form-questions", courseId],
    // oxlint-disable-next-line eslint/require-await -- kept async for the Promise<ResearchFormQuestion[]> return contract
    queryFn: async (): Promise<ResearchFormQuestion[]> =>
      getCourseMaterialResearchConsentFormQuestions({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
      }),
    enabled: courseId !== null,
  })

  // Adds all checkbox ids and false as default answer to questionIdsAndAnswers
  useEffect(() => {
    setQuestionIdsAndAnswers((prev) => {
      let res = prev
      if (!res) {
        res = {}
      }
      if (usersInitialAnswers) {
        for (const answer of usersInitialAnswers) {
          res[answer.research_form_question_id] = answer.research_consent
        }
      }
      // Find out missing questions and add them to the list
      for (const question of getResearchFormQuestions.data ?? []) {
        if (Object.prototype.hasOwnProperty.call(res, question.id) === false) {
          res[question.id] = false
        }
      }
      return res
    })
  }, [getResearchFormQuestions.data, setQuestionIdsAndAnswers, usersInitialAnswers])

  const mutation = useToastMutation(
    (answer: UserAnswer) =>
      postCourseMaterialResearchConsentFormAnswer({
        body: {
          research_consent: answer.answer,
          research_form_question_id: answer.questionId,
          user_id: assertNotNullOrUndefined(userId),
        },
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
      }),
    {
      notify: true,
      method: "POST",
    },
  )

  const handleOnSubmit = () => {
    if (questionIdsAndAnswers) {
      Object.entries(questionIdsAndAnswers).forEach(([id, bol]) => {
        const newAnswer: UserAnswer = { questionId: id, answer: bol }
        mutation.mutate(newAnswer)
      })
    }
    onClose()
  }
  return (
    <StandardDialog
      open={shouldAnswerResearchForm || editForm}
      title={
        courseName
          ? t("research-consent-for-course", { courseName })
          : t("title-research-consent-form")
      }
      showCloseButton={false}
      closeable={false}
      buttons={[
        {
          children: t("save"),
          onClick: handleOnSubmit,
          variant: "tertiary",
          transform: "capitalize",
        },
      ]}
    >
      <CheckboxContext.Provider value={{ questionIdsAndAnswers, setQuestionIdsAndAnswers }}>
        <ContentRenderer data={(researchForm.content as Block<unknown>[]) ?? []} isExam={false} />
      </CheckboxContext.Provider>
    </StandardDialog>
  )
}

export default SelectResearchConsentForm
