import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseExam } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import SelectMenu from "../../shared-module/components/InputFields/SelectField"

interface DuplicateExamProps {
  exams: CourseExam[]
  onCancel: () => void
  onSubmit: (examId: string) => void
}

const DuplicateExam: React.FC<DuplicateExamProps> = ({ exams, onSubmit }) => {
  const [examId, setExamId] = useState<string>(exams[0].id)

  const { t } = useTranslation()

  const handleSetExamId = (value: string) => {
    setExamId(value)
  }

  const handleSubmit = () => {
    onSubmit(examId)
  }

  return (
    <div>
      <SelectMenu
        id="duplicate-exam"
        onBlur={() => {
          // no-op
        }}
        onChange={(value) => handleSetExamId(value)}
        options={exams.map((e) => {
          return { label: e.name, value: e.id }
        })}
        defaultValue={exams[0].id}
      />
      <Button variant="primary" size="medium" onClick={handleSubmit}>
        {t("duplicate")}
      </Button>
    </div>
  )
}

export default DuplicateExam
