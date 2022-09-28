import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseInstance } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import RadioButton from "../../shared-module/components/InputFields/RadioButton"

const FieldContainer = styled.div`
  margin-bottom: 1.5rem;
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
        {courseInstances.map((x) => (
          <RadioButton
            key={x.id}
            label={x.name || t("default-course-instance-name")}
            value={x.id}
            onChange={(value) => setInstance(value)}
            checked={instance === x.id}
            // eslint-disable-next-line i18next/no-literal-string
            name="select-course-instance"
          />
        ))}
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
