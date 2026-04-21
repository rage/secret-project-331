"use client"

import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { baseTheme, headingFont } from "@/shared-module/common/styles"
import type { BlockEditProps, Template } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

const ALLOWED_NESTED_BLOCKS = ["core/list"]
const LEARNING_OBJECTIVE_SECTION_TEMPLATE: Template[] = [["core/list", { align: "left" }]]

const Wrapper = styled.div`
  margin: 2rem auto;
  background: #f0f5f5;
  padding: 0.5rem 1.5rem;
  @media (min-width: 768px) {
    padding: 1.5rem 2.2rem;
  }
  height: auto;
`
const Header = styled.div`
  text-align: center;
  min-height: 55px;
  display: flex;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 3px ${baseTheme.colors.green[200]} dashed;

  h2 {
    font-size: 24px;
    font-weight: 500;
    line-height: 1.2;
    color: ${baseTheme.colors.gray[700]};
    display: inline-block;
  }
`
const Content = styled.div`
  padding: 1rem 0;
  background: rgba(229, 224, 241, 0.05);
  display: grid;
  grid-template-columns: 1fr;
  @media (min-width: 768px) {
    padding: 1.5rem 2rem 1rem 0;
  }

  .block-editor-inner-blocks,
  .block-editor-block-list__layout {
    width: 100%;
  }

  .wp-block-list {
    margin: 0;
    padding-left: 0;
    list-style: none;
  }

  .wp-block-list li {
    display: grid;
    grid-template-columns: 20px 1fr;
    align-items: start;
    column-gap: 0.75rem;
    border: 1px dashed ${baseTheme.colors.gray[600]};
    border-radius: 4px;
    background: #ffffff;
    padding: 0.5rem 0.75rem 0.55rem 0.6rem;
    margin-bottom: 0.75rem;
    list-style: none;
  }

  .wp-block-list li::before {
    content: "✓";
    color: ${baseTheme.colors.green[500]};
    font-weight: 700;
    font-size: 1.35rem;
    line-height: 1;
    margin-top: 2px;
  }

  .wp-block-list li > * {
    margin: 0;
    font-family: ${headingFont};
    font-weight: 500;
    font-size: 18px;
    line-height: 1.3;
    color: #535a66;
  }

  .wp-block-list li > * > * {
    margin: 0;
  }
`

const LearningObjectiveSectionEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<Record<string, unknown>>>
> = ({ clientId }) => {
  const { t } = useTranslation()
  return (
    <BlockWrapper id={clientId}>
      <Wrapper>
        <Header>
          <h2>{t("learning-objectives-editor-title")}</h2>
        </Header>
        <Content>
          <InnerBlocks
            template={LEARNING_OBJECTIVE_SECTION_TEMPLATE}
            allowedBlocks={ALLOWED_NESTED_BLOCKS}
            templateLock="all"
          />
        </Content>
      </Wrapper>
    </BlockWrapper>
  )
}

export default LearningObjectiveSectionEditor
