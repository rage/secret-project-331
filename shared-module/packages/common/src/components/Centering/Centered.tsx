"use client"

import { css, cx } from "@emotion/css"
import React, { useContext } from "react"

import { narrowContainerWidthRem, normalContainerWidthRem } from "../../styles/constants"
import { respondToOrLarger } from "../../styles/respond"

export const defaultWidthCenteredComponentStyles = css`
  max-width: ${normalContainerWidthRem}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.xl} {
    padding: 0rem;
  }
`

export const narrowWidthCenteredComponentStyles = css`
  max-width: ${narrowContainerWidthRem}rem;
  margin-left: auto;
  margin-right: auto;
  padding: 0rem 1.375rem;
  margin-bottom: 1.25rem;
  ${respondToOrLarger.md} {
    padding: 0rem;
  }
`

export interface CenteredProps {
  variant: "default" | "narrow"
}

/**
 * Whether an outer Centered already keeps its content off the screen edges. BreakFromCentered
 * resets it, because content that breaks out of the column needs the padding again.
 */
export const CenteredPaddingContext = React.createContext<boolean>(false)

const nestedCenteredStyles = css`
  padding: 0;
`

const Centered: React.FC<React.PropsWithChildren<CenteredProps>> = ({ children, variant }) => {
  // Nested padding would double the side gutter on phones.
  const isPaddedByParent = useContext(CenteredPaddingContext)
  const styles =
    variant === "narrow" ? narrowWidthCenteredComponentStyles : defaultWidthCenteredComponentStyles
  return (
    <CenteredPaddingContext.Provider value={true}>
      <div className={cx(styles, isPaddedByParent && nestedCenteredStyles)}>{children}</div>
    </CenteredPaddingContext.Provider>
  )
}

export default Centered
