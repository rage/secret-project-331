"use client"

import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { InnerBlocks, InspectorControls } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext, useMemo } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ConditionAttributes } from "."

import InnerBlocksWrapper from "@/components/blocks/InnerBlocksWrapper"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
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

interface CodeGiveawayOption {
  id: string
  name: string
}

const CodeGiveawayBlockEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ConditionAttributes>>
> = ({ attributes, clientId, setAttributes }) => {
  const { t } = useTranslation()
  const courseId = useContext(PageContext)?.page.course_id

  const codeGivawayQuery = useQuery({
    queryKey: [`/code-giveaways/by-course/${courseId}`],
    queryFn: async () => {
      const response = await fetch(
        `/api/v0/cms/code-giveaways/by-course/${assertNotNullOrUndefined(courseId)}`,
      )
      if (!response.ok) {
        throw new Error("Failed to fetch code giveaways")
      }
      return response.json() as Promise<CodeGiveawayOption[]>
    },
    enabled: !!courseId,
  })

  const title = useMemo(() => {
    let title = t("code-giveaway")
    if (codeGivawayQuery.data) {
      const selected = codeGivawayQuery.data.find((o) => o.id === attributes.code_giveaway_id)
      if (selected) {
        title += ` (${selected.name})`
      }
    }
    return title
  }, [attributes.code_giveaway_id, codeGivawayQuery.data, t])

  const dropdownOptions = useMemo(() => {
    const res = [{ label: t("select-an-option"), value: "" }]
    if (!codeGivawayQuery.data) {
      return res
    }
    const additional = codeGivawayQuery.data.map((o) => ({
      label: o.name,
      value: o.id,
    }))
    return res.concat(additional)
  }, [codeGivawayQuery.data, t])

  return (
    <BlockPlaceholderWrapper
      id={clientId}
      title={title}
      explanation={t("code-giveaway-explanation")}
    >
      <InspectorControls>
        {codeGivawayQuery.data && (
          <Wrapper>
            <SelectField
              label={t("code-giveaway")}
              options={dropdownOptions}
              defaultValue={attributes.code_giveaway_id}
              onChangeByValue={(value) => setAttributes({ code_giveaway_id: value })}
            />
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
