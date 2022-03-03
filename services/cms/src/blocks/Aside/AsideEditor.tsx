/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { AsideComponentProps } from "."

const Wrapper = styled.aside`
  padding-bottom: 2rem;
  padding-top: 1.5rem;
  border-top: 0.4rem solid #007acc;
  border-bottom: 0.4rem solid #007acc;
  background: rgba(0, 122, 204, 0.08);
  margin: 3rem 0;
`

const Header = styled.div`
  padding: 0 2rem 1rem 2rem;
  height: auto;
  display: flex;
  align-content: center;
  margin-top: 1.5rem;

  h2 {
    font-family: "Josefin Sans", sans-serif;
    font-size: clamp(20px, 2.4vw, 30px);
    font-weight: 500;
    color: #202020;
    text-align: center;
    margin: 0 auto;
  }
`

const Body = styled.div`
  padding: 0rem 2rem;
`

const AsideEditor: React.FC<BlockEditProps<AsideComponentProps>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { title, bodyText } = attributes
  return (
    <BlockWrapper id={clientId}>
      <Wrapper>
        <Header>
          <RichText
            className="has-text-align-center wp-block-heading"
            tagName="h2"
            value={title}
            onChange={(value: string) => setAttributes({ title: value })}
            placeholder={""}
          />
        </Header>
        <Body>
          <RichText
            className="has-text-align-center wp-block-heading"
            tagName="p"
            value={bodyText}
            onChange={(value: string) => setAttributes({ bodyText: value })}
            placeholder={"Aside body"}
          />
        </Body>
      </Wrapper>
    </BlockWrapper>
  )
}

export default AsideEditor
