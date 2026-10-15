"use client"

import { useForm } from "react-hook-form"

import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import { RadioGroup, Radio } from "@/shared-module/components"

const EndQuestionnaireDialog: React.FC = () => {
  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {},
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
  })

  return (
    <StandardDialog open={true} title={"Lol"} onClose={() => {}}>
      <p>Please answer these question's for no particular reason.</p>
      <RadioGroup name="lol" control={control} label={"Did u work hard?"} orientation="horizontal">
        {[1, 2, 3, 4, 5].map((x) => (
          <Radio key={x} value={x} label={x} />
        ))}
      </RadioGroup>
      <RadioGroup name="lol2" control={control} label={"Did u have fun?"} orientation="horizontal">
        {[1, 2, 3, 4, 5].map((x) => (
          <Radio key={x} value={x} label={x} />
        ))}
      </RadioGroup>
      <p>How did you do?</p>
      <TextAreaField></TextAreaField>
    </StandardDialog>
  )
}

export default EndQuestionnaireDialog
