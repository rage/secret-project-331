"use client"

import { css } from "@emotion/css"
import { useAtomValue } from "jotai"
import React, { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { CheckboxContext } from "@/contexts/course-material/CheckboxContext"
import { postCourseMaterialResearchConsentFormAnswer } from "@/generated/course-material-api/sdk.generated"
import type { ResearchFormQuestionAnswer } from "@/generated/course-material-api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import useUserInfo from "@/shared-module/common/hooks/useUserInfo"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { Dialog } from "@/shared-module/components"
import { currentCourseIdAtom, materialCourseAtom } from "@/state/course-material/selectors"
import type { Block } from "@/types/courseMaterialBlock"
import { courseMaterialBlockClass } from "@/utils/course-material/constants"
import { researchFormQuestionIds } from "@/utils/course-material/researchConsentForm"

import ContentRenderer from "../ContentRenderer"

interface ResearchConsentFormProps {
  onClose: () => void
  editForm: boolean
  shouldAnswerResearchForm: boolean
  usersInitialAnswers?: ResearchFormQuestionAnswer[]
  /** The form's Gutenberg blocks. */
  content: unknown
  /** Shows the form outside the course material: Save only closes the dialog. */
  preview?: { courseName: string }
}

/**
 * ContentRenderer sizes its blocks for a full-width course page — 20px text, 3rem between blocks,
 * headings that outgrow the dialog title. Hold the authored form to the dialog's own scale and
 * rhythm, and let the dialog's padding be the only gutter around the outermost blocks.
 */
const authoredFormCss = css`
  .${courseMaterialBlockClass} {
    font-size: var(--font-size-2);
    margin-block: var(--space-4);
  }

  .${courseMaterialBlockClass}:first-child {
    margin-block-start: 0;
  }

  .${courseMaterialBlockClass}:last-child {
    margin-block-end: 0;
  }

  h1,
  h2,
  h3,
  p,
  ol,
  ul {
    margin-block: 0;
  }

  h1 {
    font-size: var(--font-size-3-5);
  }

  h2 {
    font-size: var(--font-size-3);
  }

  h3 {
    font-size: var(--font-size-2);
  }
`

const SelectResearchConsentForm: React.FC<React.PropsWithChildren<ResearchConsentFormProps>> = ({
  editForm,
  onClose,
  shouldAnswerResearchForm,
  usersInitialAnswers,
  content,
  preview,
}) => {
  const { t } = useTranslation()
  const userId = useUserInfo().data?.user_id
  const courseId = useAtomValue(currentCourseIdAtom)
  const materialCourseName = useAtomValue(materialCourseAtom)?.name
  const courseName = preview?.courseName ?? materialCourseName

  const { control, reset, getValues } = useForm<Record<string, boolean>>()
  const questionIds = useMemo(() => researchFormQuestionIds(content), [content])

  // Adds all checkbox ids and false as default answer to the form
  useEffect(() => {
    const res = { ...getValues() }
    if (usersInitialAnswers) {
      for (const answer of usersInitialAnswers) {
        res[answer.research_form_question_id] = answer.research_consent
      }
    }
    // useController pre-registers every rendered checkbox's key with value undefined, so
    // hasOwnProperty is already true here; check the value itself to actually catch unanswered ones.
    for (const questionId of questionIds) {
      if (res[questionId] === undefined) {
        res[questionId] = false
      }
    }
    reset(res)
  }, [questionIds, getValues, reset, usersInitialAnswers])

  const mutation = useToastMutation(
    async (answers: Record<string, boolean>) => {
      // Answers to questions since removed from the form stay out; the backend rejects them.
      for (const questionId of questionIds) {
        await postCourseMaterialResearchConsentFormAnswer({
          body: {
            research_consent: answers[questionId] ?? false,
            research_form_question_id: questionId,
            user_id: assertNotNullOrUndefined(userId),
          },
          path: {
            course_id: assertNotNullOrUndefined(courseId),
          },
        })
      }
    },
    {
      notify: true,
      method: "POST",
    },
    { onSuccess: onClose },
  )

  const handleOnSubmit = () => {
    if (preview) {
      onClose()
      return
    }
    mutation.mutate(getValues())
  }
  return (
    <Dialog
      open={shouldAnswerResearchForm || editForm}
      // Consent must be an explicit choice: no close button, and closing on Escape is a no-op.
      onClose={() => {}}
      title={
        courseName
          ? t("research-consent-for-course", { courseName })
          : t("title-research-consent-form")
      }
      showCloseButton={false}
      actions={[
        {
          label: t("save"),
          onClick: handleOnSubmit,
          variant: "primary",
          disabled: mutation.isPending,
        },
      ]}
    >
      <CheckboxContext.Provider value={{ control }}>
        <div className={authoredFormCss}>
          <ContentRenderer data={(content as Block<unknown>[]) ?? []} isExam={false} />
        </div>
      </CheckboxContext.Provider>
    </Dialog>
  )
}

export default SelectResearchConsentForm
