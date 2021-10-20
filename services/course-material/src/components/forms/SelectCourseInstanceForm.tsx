import styled from "@emotion/styled"
import { FormControlLabel, Radio, RadioGroup } from "@material-ui/core"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseInstance } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormProps {
  courseInstances: ReadonlyArray<CourseInstance>
  onSubmitForm: (courseInstanceId: string) => void
}

const NewCourseForm: React.FC<NewCourseFormProps> = ({ courseInstances, onSubmitForm }) => {
  const { t } = useTranslation()
  const [instance, setInstance] = useState(onlyItemOrUndefined(courseInstances)?.id ?? "")

  const enrollOnCourse = async () => {
    if (instance) {
      onSubmitForm(instance)
    }
  }

  return (
    <div>
      <FieldContainer aria-labelledby="Course version selection">
        <RadioGroup value={instance} onChange={(e) => setInstance(e.target.value)}>
          {courseInstances.map((x) => (
            <FormControlLabel
              control={<Radio />}
              key={x.id}
              label={x.name || t("default")}
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

function onlyItemOrUndefined<T>(items: ReadonlyArray<T>): T | undefined {
  if (items.length === 1) {
    return items[0]
  }
}

export default NewCourseForm
