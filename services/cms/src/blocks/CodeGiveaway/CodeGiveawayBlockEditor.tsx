import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import { fetchCourseInstances } from "../../services/backend/course-instances"
import { fetchCourseModulesByCourseId } from "../../services/backend/courses"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

import InnerBlocksWrapper from "@/components/blocks/InnerBlocksWrapper"
import CourseContext from "@/contexts/CourseContext"
import { fetchCodeGiveawaysByCourseId } from "@/services/backend/code-giveaways"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const ALLOWED_NESTED_BLOCKS = [
  "core/heading",
  "core/buttons",
  "core/button",
  "core/paragraph",
  "core/image",
  "core/embed",
]

const Wrapper = styled.div`
  margin-left: 1rem;
  margin-right: 1rem;
  height: auto;
`
const Text = styled.p`
  padding-bottom: 1rem;
`

const CodeGiveawayBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ attributes, clientId, setAttributes }) => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id

  const codeGivawayQuery = useQuery({
    queryKey: [`/code-giveaways/by-course/${courseId}`],
    queryFn: () => fetchCodeGiveawaysByCourseId(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })

  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("code-giveaway")}
      explanation={t("code-giveaway-explanation")}
    >
      <InspectorControls>
        {codeGivawayQuery.data && (
          <Wrapper>
            <Text>{t("module-completion-condition")}</Text>
            TODO
          </Wrapper>
        )}
      </InspectorControls>
      <InnerBlocksWrapper title={t("instructions")}>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </InnerBlocksWrapper>
    </BlockPlaceholderWrapper>
  )
}

export default CodeGiveawayBlockEditor
