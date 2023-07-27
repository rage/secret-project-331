import SaveIcon from "@mui/icons-material/Save"
import LoadingButton from "@mui/lab/LoadingButton"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import { allowerdResearchFormCoreBlocks } from "../../blocks/supportedGutenbergBlocks"
import CourseContext from "../../contexts/CourseContext"
import mediaUploadBuilder from "../../services/backend/media/mediaUpload"
import { NewResearchForm, ResearchForm } from "../../shared-module/bindings"
import Spinner from "../../shared-module/components/Spinner"
import { assertNotNullOrUndefined } from "../../shared-module/utils/nullability"
import { modifyBlocks } from "../../utils/Gutenberg/modifyBlocks"
import { removeUnsupportedBlockType } from "../../utils/Gutenberg/removeUnsupportedBlockType"

interface ResearchFormEditorProps {
  data: ResearchForm
  handleSave: (updatedTemplate: NewResearchForm) => Promise<ResearchForm>
  needToRunMigrationsAndValidations: boolean
  setNeedToRunMigrationsAndValidations: React.Dispatch<boolean>

  courseId?: string
}

const EditorLoading = <Spinner variant="medium" />

const ResearchFormGutenbergEditor = dynamic(() => import("./GutenbergEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const ResearchFormEditor: React.FC<React.PropsWithChildren<ResearchFormEditorProps>> = ({
  data,
  handleSave,
  needToRunMigrationsAndValidations,
  setNeedToRunMigrationsAndValidations,
}) => {
  const { t } = useTranslation()

  const [content, setContent] = useState<BlockInstance[]>(
    modifyBlocks(
      (data.content ?? []) as BlockInstance[],
      allowerdResearchFormCoreBlocks,
    ) as BlockInstance[],
  )
  const courseId = useContext(CourseContext)?.courseId
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOnSave = async () => {
    setSaving(true)
    try {
      const res = await handleSave({
        content: removeUnsupportedBlockType(content),
        course_id: assertNotNullOrUndefined(courseId),
      })
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
  console.log(
    "aaa",
    t,
    content,
    data,
    handleSave,
    needToRunMigrationsAndValidations,
    setNeedToRunMigrationsAndValidations,
    saving,
    error,
    handleOnSave,
  )
  return (
    <>
      <div className="editor__component">
        <div>
          {error && <pre>{error}</pre>}
          <LoadingButton
            // eslint-disable-next-line i18next/no-literal-string
            loadingPosition="start"
            startIcon={<SaveIcon />}
            loading={saving}
            onClick={handleOnSave}
          >
            {t("save")}
          </LoadingButton>
        </div>
      </div>
      {courseId && (
        <ResearchFormGutenbergEditor
          content={content}
          onContentChange={setContent}
          allowedBlocks={allowerdResearchFormCoreBlocks}
          mediaUpload={mediaUploadBuilder({ courseId: courseId })}
          needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
          setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
        />
      )}
    </>
  )
}

export default ResearchFormEditor
