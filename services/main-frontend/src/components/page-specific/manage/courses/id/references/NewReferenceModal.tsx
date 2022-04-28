import { Dialog } from "@mui/material"
import Cite from "citation-js"
import { t } from "i18next"
import { useState } from "react"

import Button from "../../../../../../shared-module/components/Button"
import TextArea from "../../../../../../shared-module/components/InputFields/TextAreaField"

interface NewReferenceModalProps {
  onClose: () => void
  open: boolean
  courseId: string
}

const NewReferenceModal: React.FC<NewReferenceModalProps> = ({ onClose, open, courseId }) => {
  const [references, setReferences] = useState("")

  const handleSubmit = () => {
    const c = Cite.parse.input.chain(references, {
      format: "string",
      type: "string",
      style: "bibtex",
      lang: "en-US",
    })
    console.log(c.forEach((c) => console.log(c.toString())))
    // console.log(c.data[0])
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <TextArea label={t("reference-bibtex-object")} onChange={(value) => setReferences(value)} />
      <Button variant="primary" size="medium" onClick={handleSubmit}>
        {t("submit")}
      </Button>
      <Button variant="secondary" size="medium" onClick={onClose}>
        {t("close")}
      </Button>
    </Dialog>
  )
}

export default NewReferenceModal
