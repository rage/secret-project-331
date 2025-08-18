import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ChatbotBlockAttributes } from "."

import { fetchNondefaultChatbotConfigurationsForCourse } from "@/services/backend/courses"
import ErrorAndLoadingWrapper from "@/shared-module/common/components/ErrorAndLoadingWrapper"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const ALLOWED_NESTED_BLOCKS = [""]

const ChatbotEditor: React.FC<React.PropsWithChildren<BlockEditProps<ChatbotBlockAttributes>>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id

  const chatbotConfigurations = useQuery({
    queryKey: [`/courses/${courseId}/nondefault-chatbot-configurations`],
    queryFn: () =>
      fetchNondefaultChatbotConfigurationsForCourse(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
  const chatbotConfigurationSelectOptions: { label: string; value: string }[] =
    chatbotConfigurations.data
      ? [...chatbotConfigurations.data.map((c) => ({ label: c.chatbot_name, value: c.id }))]
      : []

  const { chatbotConfigurationId } = attributes

  // set the initial selected value as the previously selected chatbotConfiguration,
  // but if this chatbotConfiguration has been set as default, then it won't be found in
  // the options. in this case, select the first in the list.
  const initialSelected = chatbotConfigurationSelectOptions
    .map((o) => o.value)
    .find((v) => v === chatbotConfigurationId)
    ? chatbotConfigurationId
    : chatbotConfigurationSelectOptions.at(0)?.value
  // set it as the attribute, since if the dropdown contains only one item, then
  // the onChangeByValue event will never fire and they won't be updated.
  setAttributes({
    chatbotConfigurationId: initialSelected,
    courseId: courseId ? courseId : undefined,
  })

  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("chatbot-block-placeholder")}
      explanation={t("chatbot-block-placeholder-explanation")}
    >
      <ErrorAndLoadingWrapper
        queryResult={chatbotConfigurations}
        render={(chatbotConfigurationsData) => {
          return (
            <>
              {chatbotConfigurationsData && chatbotConfigurationsData.length > 0 ? (
                <SelectField
                  className={css`
                    width: inherit;
                  `}
                  label={t("select-an-option")}
                  options={chatbotConfigurationSelectOptions}
                  defaultValue={initialSelected}
                  onChangeByValue={(v) => {
                    setAttributes({
                      chatbotConfigurationId: v,
                      courseId: courseId ? courseId : undefined,
                    })
                  }}
                />
              ) : (
                <p>{t("no-chatbots-for-course")}</p>
              )}
            </>
          )
        }}
      />

      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}

export default ChatbotEditor
