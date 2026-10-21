// oxlint-disable i18next/no-literal-string
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"

import type { CourseModuleEndingQuestion } from "@/generated/course-material-api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { RadioGroup, Radio, TextArea, Button, Checkbox } from "@/shared-module/components"

interface Answer {
  free_text: string
  select: string
  multi_select: string
}

export interface EndQuestionnaireDialogProps {
  questions: CourseModuleEndingQuestion[]
}

type AnswersData = Record<string, Answer>

const EndQuestionnaireDialog: React.FC<EndQuestionnaireDialogProps> = ({ questions }) => {
  const [open, setOpen] = useState(false)
  const { control, handleSubmit } = useForm<AnswersData>({
    defaultValues: {},
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
  })

  /*   const answerEndQuestionnaireMutation = useToastMutationOptions({ notify: true, method: "POST" }) */

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true)
        }}
      >
        Answer questions
      </Button>
      <StandardDialog
        open={open}
        title={"Answer these questions"}
        onClose={() => {
          setOpen(false)
        }}
      >
        <p>Please answer these questions for no particular reason.</p>
        <form
          onSubmit={handleSubmit((data) => {
            console.log(data)
          })}
        >
          {questions.map((q) => {
            return (
              <>
                <label>{q.question_text}</label>
                {q.select_labels && (
                  <RadioGroup
                    control={control}
                    name={`${q.id}-select`}
                    label={q.question_text}
                    isRequired
                    // oxlint-disable-next-line i18next/no-literal-string
                    orientation="horizontal"
                  >
                    {q.select_labels.map((x) => (
                      <Radio key={x} value={x} label={x} />
                    ))}
                  </RadioGroup>
                )}
                {q.multi_select_labels &&
                  q.multi_select_labels.map((m) => (
                    <Checkbox
                      key={m}
                      control={control}
                      name={`${q.id}-multi-select.${m}`}
                      label={m}
                    />
                  ))}
                {q.question_free_text_instruction && (
                  <label>{q.question_free_text_instruction}</label>
                )}
                <TextArea
                  control={control}
                  name={`${q.id}-free-text`}
                  label={q.question_text}
                  autoResize={true}
                  isRequired
                />
              </>
            )
          })}
          <button>Submit</button>
        </form>
      </StandardDialog>
    </>
  )
}

export default EndQuestionnaireDialog
