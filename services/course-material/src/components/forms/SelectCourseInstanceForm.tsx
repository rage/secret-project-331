import styled from "@emotion/styled"
import { FormControlLabel, Radio, RadioGroup } from "@mui/material"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseInstance } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormProps {
  courseInstances: CourseInstance[]
  onSubmitForm: (courseInstanceId: string) => void
  initialSelectedInstanceId?: string
}

const NewCourseForm: React.FC<React.PropsWithChildren<NewCourseFormProps>> = ({
  courseInstances,
  onSubmitForm,
  initialSelectedInstanceId,
}) => {
  const { t } = useTranslation()
  const [instance, setInstance] = useState(
    figureOutInitialValue(courseInstances, initialSelectedInstanceId),
  )

  const enrollOnCourse = async () => {
    if (instance) {
      onSubmitForm(instance)
    }
  }

  return (
    <div>
      <FieldContainer>
        <RadioGroup value={instance} onChange={(e) => setInstance(e.target.value)}>
          {courseInstances.map((x) => (
            <FormControlLabel
              control={<Radio />}
              key={x.id}
              label={x.name || t("default-course-instance-name")}
              value={x.id}
            />
          ))}
        </RadioGroup>
      </FieldContainer>
      <div>
        <Button size="medium" variant="primary" onClick={enrollOnCourse} disabled={!instance}>
          {t("continue")}
        </Button>
      </div>
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

export default NewCourseForm
