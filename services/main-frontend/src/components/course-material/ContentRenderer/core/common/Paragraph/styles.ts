import { css } from "@emotion/css"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import colorMapper from "@/styles/course-material/colorMapper"
import { fontSizeMapper, mobileFontSizeMapper } from "@/styles/course-material/fontSizeMapper"

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

export const paragraphBaseDefaults = `
  margin: 1.25rem 0;
  min-width: 1px;
  height: auto;
  line-height: 160%;
`

export const paragraphDefaultBlockStyles = `
  ${paragraphBaseDefaults}
  color: ${colorMapper(undefined)};
  background-color: ${colorMapper(undefined, UNSET_COLOR)};
  font-size: ${mobileFontSizeMapper(undefined)};
  text-align: left;

  ${respondToOrLarger.md} {
    font-size: ${fontSizeMapper(undefined)};
  }
`

// flow-root contains a drop cap's float without clipping long words, glossary popovers or citations.
export const baseParagraphStyles = css`
  margin: 1.25rem 0;
  min-width: 1px;
  display: flow-root;
  height: auto;
`

export const getParagraphStyles = (
  textColor: string | undefined,
  backgroundColor: string | undefined,
  fontSize: string | undefined,
  dropCap: boolean,
  align: string | undefined,
  fitText?: boolean,
) => css`
  ${paragraphBaseDefaults}
  display: flow-root;
  color: ${colorMapper(textColor)};
  background-color: ${colorMapper(backgroundColor, UNSET_COLOR)};
  font-size: ${mobileFontSizeMapper(fontSize)};
  text-align: ${align ?? "left"};
  ${backgroundColor && `padding: 1.25em 2.375em !important;`}

  ${respondToOrLarger.md} {
    ${
      fitText
        ? `font-size: clamp(1rem, 4vw, ${fontSize ? fontSizeMapper(fontSize) : "1.5rem"});`
        : `font-size: ${fontSizeMapper(fontSize)};`
    }
  }

  ${dropCap ? hasDropCap : null}
`

export const getEditingStyles = (
  textColor: string | undefined,
  backgroundColor: string | undefined,
  fontSize: string | undefined,
) => css`
  ${baseParagraphStyles}
  color: ${colorMapper(textColor)};
  background-color: ${colorMapper(backgroundColor, UNSET_COLOR)};
  font-size: ${fontSizeMapper(fontSize)};
  ${backgroundColor && `padding: 1.25em 2.375em;`}
  border: 1px;
  border-style: dotted;
`

export const getEditableHoverStyles = (isEditing: boolean) => css`
  ${isEditing && `cursor: text;`}

  ${
    !isEditing &&
    `
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(121, 247, 96, 0.05);
      box-shadow: 0 0 0 2px rgba(93, 163, 36, 0.2);
      border-radius: 3px;
    }
  `
  }
`
