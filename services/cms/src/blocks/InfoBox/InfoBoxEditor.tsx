import styled from "@emotion/styled"
import { RichText } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React from "react"

import BlockWrapper from "../BlockWrapper"

import { InfoBoxComponentProps } from "."

const Wrapper = styled.aside`
  @media (min-width: 711px) {
    width: 100vw;
  }

  @media (min-width: 425px) {
    width: 100vw;
  }

  @media (min-width: 1px) {
    width: 100vw;
    position: relative;
    left: calc(-50vw + 50%);
    padding: 1rem;
    margin-bottom: 5rem;
    margin-top: 4rem;
    background: rgba(246, 235, 232, 0.5) none repeat scroll 0% 0%;
    padding-left: 1rem;
    padding-top: 3rem;
    padding-bottom: 3rem;
    min-height: 17em;
    ul {
      padding-inline-start: 40px;
    }
  }
`
const Container = styled.div`
  max-width: 880px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
`

const Body = styled.div`
  @media (min-width: 1px) {
    padding-bottom: 0.5rem;
    width: auto;
    margin-left: 2em;
  }
  @media (min-width: 425px) {
    padding-bottom: 0.5rem;
    width: auto;
    margin-left: 8em;
  }
  @media (min-width: 900px) {
    padding-bottom: 0.5rem;
    width: auto;
    margin-left: 15em;
  }
  p {
    font-size: 1.125rem;
    line-height: 1.89;
  }
`

const InfoBoxEditor: React.FC<BlockEditProps<InfoBoxComponentProps>> = ({
  clientId,
  attributes,
  setAttributes,
}) => {
  const { title, bodyText } = attributes
  return (
    <BlockWrapper id={clientId}>
      <Wrapper>
        <Container>
          <Body>
            <RichText
              className="has-text-align-left wp-block-heading"
              // eslint-disable-next-line i18next/no-literal-string
              tagName="h3"
              value={title}
              onChange={(value: string) => setAttributes({ title: value })}
              placeholder={""}
            />
            <RichText
              className="has-text-align-left wp-block-heading"
              // eslint-disable-next-line i18next/no-literal-string
              tagName="p"
              value={bodyText}
              onChange={(value: string) => setAttributes({ bodyText: value })}
              // eslint-disable-next-line i18next/no-literal-string
              placeholder={"Infobox body"}
            />
          </Body>
        </Container>
      </Wrapper>
    </BlockWrapper>
  )
}

export default InfoBoxEditor
