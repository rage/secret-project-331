import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { CourseExam, NewExam } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import TimePicker from "../../shared-module/components/InputFields/DateTimeLocal"
import SelectMenu from "../../shared-module/components/InputFields/SelectField"
import TextArea from "../../shared-module/components/InputFields/TextAreaField"
import TextField from "../../shared-module/components/InputFields/TextField"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewExamFormProps {
  organizationId: string
  onSubmitNewExamForm: (organization: string, newExam: NewExam) => Promise<void>
  onSubmitDuplicateExamForm?: (oldExamId: string, newExam: NewExam) => Promise<void>
  exams?: CourseExam[]
  onClose: () => void
}

const NewCourseForm: React.FC<NewExamFormProps> = ({
  organizationId,
  onSubmitNewExamForm,
  onSubmitDuplicateExamForm,
  exams,
  onClose,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [instructions, setInstructions] = useState("")
  const [startsAt, setStartsAt] = useState<Date | null>(null)
  const [endsAt, setEndsAt] = useState<Date | null>(null)
  const [timeMinutes, setTimeMinutes] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copyExam, setCopyExam] = useState(false)
  const [submitDisabled, setSubmitDisabled] = useState(false)
  const [examId, setExamId] = useState("")

  const handleDuplicateMenu = (e: string, examsData: CourseExam[]) => {
    const exam = examsData.find((exam) => exam.id === e)
    const examName = exam?.name ? exam?.name : ""

    setExamId(e)
    if (examName !== "") {
      setName(examName)
    }
  }

  const createDuplicateExam = async () => {
    if (!onSubmitDuplicateExamForm) {
      return null
    }
    try {
      setSubmitDisabled(true)

      const newExam: NewExam = {
        name: name,
        instructions,
        organization_id: organizationId,
        ends_at: endsAt,
        starts_at: startsAt,
        time_minutes: timeMinutes,
        id: v4(),
      }
      if (examId) {
        await onSubmitDuplicateExamForm(examId, newExam)
        setName("")
        setInstructions("")
        setStartsAt(null)
        setEndsAt(null)
        setTimeMinutes(0)
        setError(null)
      }
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e
      }
      setError(e.toString())
    } finally {
      setSubmitDisabled(false)
    }
  }

  const createNewExam = async () => {
    try {
      setSubmitDisabled(true)

      await onSubmitNewExamForm(organizationId, {
        id: v4(),
        organization_id: organizationId,
        name,
        instructions,
        time_minutes: timeMinutes,
        starts_at: startsAt,
        ends_at: endsAt,
      })
      setName("")
      setInstructions("")
      setStartsAt(null)
      setEndsAt(null)
      setTimeMinutes(0)
      setError(null)
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e
      }
      setError(e.toString())
    } finally {
      setSubmitDisabled(false)
    }
  }

  return (
    <div
      className={css`
        width: 500px;
        padding: 1rem 0;
      `}
    >
      <div>
        {error && <pre>{error}</pre>}
        <FieldContainer>
          <TextField
            required
            label={t("text-field-label-name")}
            value={name}
            onChange={(value) => {
              setName(value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextArea
            required
            label={t("text-field-label-instructions")}
            value={instructions}
            onChange={(value) => {
              setInstructions(value)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TextField
            required
            label={t("text-field-label-time-minutes")}
            type="number"
            value={timeMinutes as unknown as string}
            onChange={(value) => {
              setTimeMinutes(value as unknown as number)
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TimePicker
            label={t("text-field-label-starts-at")}
            onChange={(value) => {
              setStartsAt(new Date(value))
            }}
          />
        </FieldContainer>
        <FieldContainer>
          <TimePicker
            label={t("text-field-label-ends-at")}
            onChange={(value) => {
              setEndsAt(new Date(value))
            }}
          />
        </FieldContainer>
        {exams && (
          <FieldContainer>
            <CheckBox
              // eslint-disable-next-line i18next/no-literal-string
              label="copy content from other exam"
              checked={copyExam}
              onChange={() => {
                setCopyExam(!copyExam)
              }}
            />
          </FieldContainer>
        )}
        {exams && copyExam && (
          <FieldContainer>
            <SelectMenu
              id="duplicate-exam-select-menu"
              onBlur={() => {
                // no-op
              }}
              defaultValue={exams[0].id}
              onChange={(e) => handleDuplicateMenu(e, exams)}
              options={exams.map((exam) => {
                return { label: exam.name, value: exam.id }
              })}
            ></SelectMenu>
          </FieldContainer>
        )}
        <FieldContainer>
          <Button
            variant="primary"
            size="medium"
            onClick={copyExam ? createDuplicateExam : createNewExam}
            disabled={submitDisabled}
          >
            {t("create-exam")}
          </Button>
          <Button variant="primary" size="medium" onClick={onClose}>
            {t("close")}
          </Button>
        </FieldContainer>
      </div>
    </div>
  )
}

export default NewCourseForm
