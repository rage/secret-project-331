import { TextField } from "@material-ui/core"
import { DateTimePicker, LocalizationProvider } from "@material-ui/lab"
import AdapterDateFns from "@material-ui/lab/AdapterDateFns"
import React, { useState } from "react"
import { useForm } from "react-hook-form"

import { CourseInstance, CourseInstanceForm } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import FormField from "../FormField"

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

  return (
    <>
      <form onSubmit={onSubmitWrapper}>
        <FormField
          id={"name"}
          error={errors["name"]}
          defaultValue={initialData?.name}
          placeholder={"Instance name"}
          register={register}
        />
        <FormField
          id={"description"}
          error={errors["description"]}
          defaultValue={initialData?.description}
          placeholder={"Instance description"}
          register={register}
        />
        <FormField
          id={"supportEmail"}
          error={errors["supportEmail"]}
          defaultValue={initialData?.support_email}
          placeholder={"Support email"}
          register={register}
        />
        <FormField
          id={"teacherName"}
          error={errors["teacherName"]}
          defaultValue={initialData?.teacher_in_charge_name}
          placeholder={"Teacher-in-charge name"}
          register={register}
        />
        <FormField
          id={"teacherEmail"}
          error={errors["teacherEmail"]}
          defaultValue={initialData?.teacher_in_charge_email}
          placeholder={"Teacher-in-charge email"}
          register={register}
        />
        <br />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateTimePicker
            label={"Opening time"}
            inputFormat={"yyyy-MM-dd HH:mm"}
            renderInput={(props) => <TextField id={"openingTime"} {...props} />}
            value={newOpeningTime}
            onChange={(time) => setNewOpeningTime(time)}
          />
          <br />
          <br />
          <DateTimePicker
            label={"Closing time"}
            inputFormat={"yyyy-MM-dd HH:mm"}
            renderInput={(props) => <TextField id={"closingTime"} {...props} />}
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
