"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"

import type { CourseModuleEndingQuestion } from "@/generated/course-material-api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { RadioGroup, Radio, TextArea } from "@/shared-module/components"

export interface EndQuestionnaireDialogProps {
  questions: CourseModuleEndingQuestion[]
}

const EndQuestionnaireDialog: React.FC<EndQuestionnaireDialogProps> = ({ questions }) => {
  const [open, setOpen] = useState(true)
  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {},
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
  })

  /*   const answerEndQuestionnaireMutation = useToastMutationOptions({ notify: true, method: "POST" }) */

  return (
    <StandardDialog
      open={open}
      title={"Answer these questions"}
      onClose={() => {
        setOpen(false)
      }}
    >
      <p>Please answer these question's for no particular reason.</p>
      <form
        onSubmit={handleSubmit((data) => {
          /*           answerEndQuestionnaireMutation.mutate({
            body: {
              name: data.name.trim(),
              course_id: courseId,
              purpose: data.purpose.trim(),
              skip_azure_stuff: false,
            },
          }) */
        })}
      >
        {questions.map((q) => {
          if (q.question_type === "FreeText") {
            return (
              <p key={q.id}>
                <label>{q.question_text}</label>
                <TextArea control={control} autoResize={true} />
              </p>
            )
          }
          // question is a radio group
          const options = Array.from({ length: q.rating_options_n ?? 1 }, (_, i) => i)
          // todo map labels
          return (
            <RadioGroup
              key={q.id}
              control={control}
              label={q.question_text}
              // oxlint-disable-next-line i18next/no-literal-string
              orientation="horizontal"
            >
              {options.map((x) => (
                <Radio key={x} value={x} label={x} />
              ))}
            </RadioGroup>
          )
        })}
      </form>
    </StandardDialog>
  )
}

export default EndQuestionnaireDialog
