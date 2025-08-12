import { useQuery } from "@tanstack/react-query"
//import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ChatbotBlockAttributes } from "."

import { fetchChatbotConfigurationsForCourse } from "@/services/backend/chatbot-block"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

//const ALLOWED_NESTED_BLOCKS = [""]

const ChatbotEditor: React.FC<React.PropsWithChildren<BlockEditProps<ChatbotBlockAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id

  const chatbotConfigurations = useQuery({
    queryKey: [`/courses/${courseId}/chatbot-configurations`],
    queryFn: () => fetchChatbotConfigurationsForCourse(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
  const chatbotConfigurationSelectOptions: { label: string; value: string }[] =
    chatbotConfigurations.data
      ? [...chatbotConfigurations.data.map((c) => ({ label: c.chatbot_name, value: c.id }))]
      : []

  const { chatbotConfigurationId } = attributes

  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("chatbot-block-placeholder")}
      explanation={t("chatbot-block-placeholder-explanation")}
    >
      {chatbotConfigurations.data ? (
        <SelectField
          id="aa"
          label={t("select-an-option")}
          options={chatbotConfigurationSelectOptions}
          defaultValue={chatbotConfigurationId}
          defaultChecked
          onChange={(e) => {
            console.log(e.target)
            setAttributes({
              chatbotConfigurationId: e.target.value,
            })
            console.log(e.target.selectedOptions)
          }}
        />
      ) : (
        <p>{t("no-chatbots-for-course")}</p>
      )}
    </BlockPlaceholderWrapper>
  )
}

export default ChatbotEditor
