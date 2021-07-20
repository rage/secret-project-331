import styled from "@emotion/styled"
import { Button, FormControlLabel, Radio, RadioGroup } from "@material-ui/core"
import React, { useState } from "react"

import { CourseInstance } from "../../shared-module/bindings"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

interface NewCourseFormProps {
  courseInstances: ReadonlyArray<CourseInstance>
  onSubmitForm: (courseInstanceId: string) => void
}

const NewCourseForm: React.FC<NewCourseFormProps> = ({ courseInstances, onSubmitForm }) => {
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
              label={x.name || "default"}
              value={x.id}
            />
          ))}
        </RadioGroup>
      </FieldContainer>
      <div>
        <Button onClick={enrollOnCourse} disabled={!instance}>
          Continue
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
