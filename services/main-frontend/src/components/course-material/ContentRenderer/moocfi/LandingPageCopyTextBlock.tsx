"use client"
import styled from "@emotion/styled"
import React from "react"

import { BlockRendererProps } from ".."
import InnerBlocks from "../util/InnerBlocks"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Centered from "@/shared-module/common/components/Centering/Centered"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Wrapper = styled.div`
  margin: 0.5rem auto;
  padding-bottom: 0; /* remove added bottom space */
  position: relative;

  /* Outer lines */
  .line {
    position: absolute;
    background: #cecfd3;
    z-index: 0;
    pointer-events: none;
  }

  .top {
    width: 100%;
    height: 2px;
    top: 10px;
  }

  .bottom {
    width: 100%;
    height: 2px;
    bottom: 10px;
  }

  .left {
    height: 100%;
    width: 2px;
    left: 10px;
  }

  .right {
    height: 100%;
    width: 2px;
    right: 10px;
  }

  /* Inner top line (same width as box, smaller gap) */
  .inner-top {
    position: absolute;
    height: 2px;
    left: 10px;
    right: 10px;
    top: 24px;
    background: #e2e3e7;
    z-index: 0;
  }

  /* Content area (keeps text inside vertical lines) */
  .content {
    position: relative;
    z-index: 1;
    padding: 1.5rem 2rem 1.5rem 2rem;
  }

  /* Reset indents on all descendants so heading + paragraph align */
  .content * {
    margin-left: 0 !important;
    padding-left: 0 !important;
  }

  /* Heading */
  .content h2 {
    margin: 0 0 1rem 0 !important;
    padding: 0 !important;
    font-weight: 700 !important;
    color: ${baseTheme.colors.gray[700]} !important;
  }

  .content #about-this-course {
    border: none !important;
  }

  /* Paragraphs */
  .content p {
    margin: 0 0 1rem 0 !important;
    padding: 0 !important;
    font-weight: 400 !important;
  }

  /* Lists */
  .content ul,
  .content ol {
    margin: 0 0 1rem 0 !important;
    padding-left: 1.5rem !important; /* reintroduce list indent */
  }

  .content li {
    margin: 0 0 0.25rem 0;
    padding-right: 2rem;
  }

  .content li::marker {
    content: "☉  ";
    font-size: 1rem;
    color: ${baseTheme.colors.gray[700]};
  }

  /* Subheadings */
  .content h3 {
    margin: 1.5rem 0 0 0 !important;
    padding-top: 0.75rem !important;
    font-weight: 700 !important;
    color: ${baseTheme.colors.gray[700]};
    border-top: 2px solid #e2e3e7;
  }

  /* Remove trailing empty space */
  .content > :last-child {
    margin-bottom: 0 !important;
  }

  /* Reduce the margin-top of the core/columns blocks from 3rem to 1.5rem */
  .content [data-block-name="core/columns"] {
    margin-top: 1.5rem !important;
  }
`

const LandingPageCopyTextBlock: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = (
  props,
) => {
  return (
    <BreakFromCentered sidebar={false}>
      <Centered variant="default">
        <Wrapper>
          <div className="line top" />
          <div className="line bottom" />
          <div className="line right" />
          <div className="line left" />
          <div className="inner-top" />
          <div className="content">
            <InnerBlocks parentBlockProps={props} dontAllowInnerBlocksToBeWiderThanParentBlock />
          </div>
        </Wrapper>
      </Centered>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(LandingPageCopyTextBlock)
