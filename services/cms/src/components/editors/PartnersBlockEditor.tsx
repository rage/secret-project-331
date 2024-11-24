/* eslint-disable i18next/no-literal-string */
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import { allowedPartnerCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import CourseContext from "../../contexts/CourseContext"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"

import { PartnersBlock } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import Spinner from "@/shared-module/common/components/Spinner"

interface PartnersBlockEditorProps {
  data: PartnersBlock
  handleSave: (updatedTemplate: unknown) => Promise<PartnersBlock>
}

const EditorLoading = <Spinner variant="medium" />

const PartnersBlockGutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const PartnersSectionEditor: React.FC<React.PropsWithChildren<PartnersBlockEditorProps>> = ({
  data,
  handleSave,
}) => {
  const courseId = useContext(CourseContext)?.courseId
  const { t } = useTranslation()
  const [content, setContent] = useState<BlockInstance[]>(
    modifyBlocks(data.content as BlockInstance[], allowedPartnerCoreBlocks) as BlockInstance[],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    }
  }

  return (
    <>
      <div className="editor__component">
        <div>
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
    </>
  )
}
export default PartnersSectionEditor
