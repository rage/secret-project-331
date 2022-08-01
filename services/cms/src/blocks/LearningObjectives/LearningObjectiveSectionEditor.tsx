import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, Template } from "@wordpress/blocks"
import React from "react"
import { useTranslation } from "react-i18next"

import BlockWrapper from "../BlockWrapper"

const ALLOWED_NESTED_BLOCKS = ["core/list"]
const LEARNING_OBJECTIVE_SECTION_TEMPLATE: Template[] = [
  ["core/list", { placeholder: "Insert text...", align: "left" }],
]

const Wrapper = styled.div`
  margin: 2rem auto;
  max-width: 1000px;
  height: auto;
`
const Header = styled.div`
  background: #44827e;
  text-align: center;
  min-height: 55px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.5rem;

  h2 {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
    text-transform: uppercase;
    color: #ffffff;
  }
`
const Content = styled.div`
  background: rgba(229, 224, 241, 0.05);
  display: grid;
  grid-template-columns: 1fr 1fr;
  row-gap: 30px;
  column-gap: 5px;
  border-right: 1px solid #e5e0f1;
  border-left: 1px solid #e5e0f1;
  border-bottom: 1px solid #e5e0f1;

  @media (max-width: 767.98px) {
    padding: 1rem 1rem 2rem 1rem;
    grid-template-columns: 1fr;
    row-gap: 25px;
  }
`

const LearningObjectiveSectionEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, unknown>>>
> = ({ clientId }) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
      <Header>
        <h2>{t("learning-objectives")}</h2>
      </Header>
      <Content>
        <Wrapper>
          <InnerBlocks
            template={LEARNING_OBJECTIVE_SECTION_TEMPLATE}
            allowedBlocks={ALLOWED_NESTED_BLOCKS}
            // eslint-disable-next-line i18next/no-literal-string
            templateLock="all"
          />
        </Wrapper>
      </Content>
    </BlockWrapper>
  )
}

export default LearningObjectiveSectionEditor
