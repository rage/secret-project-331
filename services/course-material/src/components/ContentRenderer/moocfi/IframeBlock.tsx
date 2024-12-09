import { css } from "@emotion/css"

import { BlockRendererProps } from ".."

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"

export interface IframeAttributes {
  url: string | undefined
  heightPx: number | undefined
  widthPx: number | undefined
}

const IFRAME = "iframe"

export const IframeBlock: React.FC<BlockRendererProps<IframeAttributes>> = (props) => {
  if (!props.data.attributes.url) {
    return null
  }

  const { heightPx, widthPx } = props.data.attributes

  return (
    <BreakFromCentered sidebar={false}>
      <figure
        className={css`
          width: 100%;
          max-width: ${widthPx ?? 1000}px;
          margin: 4rem auto;
        `}
      >
        <iframe
          className={css`
            width: 100%;
            height: ${heightPx ?? 630}px;
            border: none;
            overflow: hidden;
          `}
          src={props.data.attributes.url}
          allow="fullscreen"
          title={IFRAME}
          sandbox="allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox"
        ></iframe>
      </figure>
    </BreakFromCentered>
  )
}
