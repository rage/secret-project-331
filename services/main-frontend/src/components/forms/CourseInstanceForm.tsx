import { TextField } from "@material-ui/core"
import { DateTimePicker, LocalizationProvider } from "@material-ui/lab"
import AdapterDateFns from "@material-ui/lab/AdapterDateFns"
import React, { useState } from "react"
import { useForm } from "react-hook-form"

import { CourseInstance, CourseInstanceForm } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"

interface FormProps {
  initialData: CourseInstance | null
  onSubmit: (form: CourseInstanceForm) => void
  onCancel: () => void
}

interface Fields {
  name: string
  description: string
  supportEmail: string
  teacherName: string
  teacherEmail: string
}

const Form: React.FC<FormProps> = ({ initialData, onSubmit, onCancel }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Fields>()
  const [newOpeningTime, setNewOpeningTime] = useState(initialData?.starts_at || null)
  const [newClosingTime, setNewClosingTime] = useState(initialData?.ends_at || null)
  const onSubmitWrapper = handleSubmit((data) => {
    onSubmit({
      name: data.name || null,
      description: data.description || null,
      support_email: data.supportEmail || null,
      teacher_in_charge_name: data.teacherName,
      teacher_in_charge_email: data.teacherEmail,
      opening_time: newOpeningTime,
      closing_time: newClosingTime,
    })
  })

  const field = (
    id: "name" | "description" | "supportEmail" | "teacherName" | "teacherEmail",
    placeholder: string,
    defaultValue: string,
    required: boolean,
  ) => {
    return (
      <>
        <label htmlFor={id}>{placeholder}</label>
        <br />
        {required && errors[id] && (
          <>
            <span>This field is required</span>
            <br />
          </>
        )}
        <input
          id={id}
          placeholder={placeholder}
          defaultValue={defaultValue}
          {...register(id, { required })}
        ></input>
        <br />
      </>
    )
  }

  return (
    <>
      <form onSubmit={onSubmitWrapper}>
        {field("name", "Instance name", initialData?.name || "", false)}
        {field("description", "Instance description", initialData?.description || "", false)}
        {field("supportEmail", "Support email", initialData?.support_email || "", false)}
        {field(
          "teacherName",
          "Teacher-in-charge name",
          initialData?.teacher_in_charge_name || "",
          true,
        )}
        {field(
          "teacherEmail",
          "Teacher-in-charge email",
          initialData?.teacher_in_charge_email || "",
          true,
        )}
        <br />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateTimePicker
            label={"Opening time"}
            inputFormat={"dd/MM/yyyy HH:mm"}
            renderInput={(props) => <TextField {...props} />}
            value={newOpeningTime}
            onChange={(time) => setNewOpeningTime(time)}
          />
          <br />
          <br />
          <DateTimePicker
            label={"Closing time"}
            inputFormat={"dd/MM/yyyy HH:mm"}
            renderInput={(props) => <TextField {...props} />}
            value={newClosingTime}
            onChange={(time) => setNewClosingTime(time)}
          />
        </LocalizationProvider>
        <br />
        <br />
        <Button variant="primary" size="medium" type="submit" value="Submit">
          Submit
        </Button>
        <Button variant="secondary" size="medium" onClick={onCancel}>
          Cancel
        </Button>
      </form>
    </>
  )
}

export default Form
