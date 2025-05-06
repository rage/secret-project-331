import { css } from "@emotion/css"
import { BlockInstance } from "@wordpress/blocks"
import React, { useContext, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { allowedPartnerCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import CourseContext from "../../contexts/CourseContext"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"

import { PartnersBlock } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import SuccessNotification from "@/shared-module/common/components/Notifications/Success"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"

interface PartnersBlockEditorProps {
  data: PartnersBlock
  handleSave: (updatedTemplate: unknown) => Promise<PartnersBlock>
}

const PartnersBlockGutenbergEditor = dynamicImport(() => import("./GutenbergEditor"))

const PartnersSectionEditor: React.FC<React.PropsWithChildren<PartnersBlockEditorProps>> = ({
  data,
  handleSave,
}) => {
  const courseId = useContext(CourseContext)?.courseId
  const { t } = useTranslation()
  const [content, setContent] = useState<BlockInstance[]>(
    modifyBlocks(
      (data.content ?? []) as BlockInstance[],
      allowedPartnerCoreBlocks,
    ) as BlockInstance[],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  //NB: refactor to use useToast
  const handleOnSave = async () => {
    setSaving(true)
    try {
      const res = await handleSave(content)
      setContent(res.content as BlockInstance[])
      setError(null)
    } catch (e: unknown) {
      if (!(e instanceof Error)) {
        throw e
      }
      setError(e.toString())
    } finally {
      setSaving(false)
      setSuccessMessage(t("content-saved-successfully"))
    }
  }

  // Hide success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => setSuccessMessage(null), 1000)
      return () => clearTimeout(timeout) // Clear timeout if component unmounts
    }
  }, [successMessage])

  return (
    <>
      <div className="editor__component">
        <div
          className={css`
            margin: 4rem 0 2.5rem 0;
          `}
        >
          {error && <pre>{error}</pre>}
          <Button variant="primary" size="medium" disabled={saving} onClick={handleOnSave}>
            {t("save")}
          </Button>
        </div>
      </div>

      {courseId && (
        <PartnersBlockGutenbergEditor
          content={content}
          onContentChange={setContent}
          allowedBlocks={allowedPartnerCoreBlocks}
          mediaUpload={mediaUploadBuilder({ courseId: courseId })}
          needToRunMigrationsAndValidations={false}
          setNeedToRunMigrationsAndValidations={() => {}}
        />
      )}
      {successMessage && <SuccessNotification message={successMessage} />}
    </>
  )
}
export default PartnersSectionEditor
