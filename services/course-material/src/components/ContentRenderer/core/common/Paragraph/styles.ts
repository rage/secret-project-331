import { css } from "@emotion/css"

import colorMapper from "../../../../../styles/colorMapper"
import { fontSizeMapper, mobileFontSizeMapper } from "../../../../../styles/fontSizeMapper"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const UNSET_COLOR = "unset"

export const hasDropCap = css`
  :first-letter {
    float: left;
    font-size: 8.4em;
    line-height: 0.68;
    font-weight: 100;
    margin: 0.05em 0.1em 0 0;
    text-transform: uppercase;
    font-style: normal;
  }
`

export const baseParagraphStyles = (hideOverflow = false) => css`
  margin: 1.25rem 0;
  min-width: 1px;
  ${hideOverflow && `overflow-x: hidden; overflow-y: hidden;`}
  height: auto;
`

export const getParagraphStyles = (
  textColor: string | undefined,
  backgroundColor: string | undefined,
  fontSize: string | undefined,
  hideOverflow: boolean,
  dropCap: boolean,
  align: string | undefined,
) => css`
  ${baseParagraphStyles(hideOverflow)}
  color: ${colorMapper(textColor)};
  background-color: ${colorMapper(backgroundColor, UNSET_COLOR)};
  font-size: ${mobileFontSizeMapper(fontSize)};
  line-height: 160%;
  text-align: ${align ?? "left"};
  ${backgroundColor && `padding: 1.25em 2.375em !important;`}

  ${respondToOrLarger.md} {
    font-size: ${fontSizeMapper(fontSize)};
  }

  ${dropCap ? hasDropCap : null}
`

export const getEditingStyles = (
  textColor: string | undefined,
  backgroundColor: string | undefined,
  fontSize: string | undefined,
) => css`
  ${baseParagraphStyles(true)}
  color: ${textColor};
  background-color: ${backgroundColor};
  font-size: ${fontSizeMapper(fontSize)};
  ${backgroundColor && `padding: 1.25em 2.375em;`}
  border: 1px;
  border-style: dotted;
`

export const getEditableHoverStyles = (isEditing: boolean) => css`
  ${isEditing && `cursor: text;`}

  ${!isEditing &&
  `
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(121, 247, 96, 0.05);
      box-shadow: 0 0 0 2px rgba(93, 163, 36, 0.2);
      border-radius: 3px;
    }
  `}
`
