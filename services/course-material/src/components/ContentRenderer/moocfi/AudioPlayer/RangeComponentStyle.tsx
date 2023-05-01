import { css } from "@emotion/css"

// eslint-disable-next-line i18next/no-literal-string
export const styledRangeInput = css`
  /* Input range - chrome and safari */

  input[type="range"] {
    --range-progress: 0;
    -webkit-appearance: none;
    position: relative;
    background: #d5def2;
    width: 100%;
    height: 4px;
    cursor: pointer;
  }

  /* Input range - firefox */
  input[type="range"]::-moz-range-track {
    position: relative;
    background: #d5def2;
    width: 100%;
    height: 4px;
    cursor: pointer;
  }

  /* played progress length - Chrome & safari*/
  input[type="range"]::before {
    content: "";
    height: 4px;
    background: #b0c1e4;
    width: var(--range-progress);
    border-bottom-left-radius: 2px;
    border-top-left-radius: 2px;
    position: absolute;
    top: 0;
    left: 0;
  }

  /* played progress length - firefox */
  input[type="range"]::-moz-range-progress {
    background: #b0c1e4;
    border-bottom-left-radius: 2px;
    border-top-left-radius: 2px;
    height: 4px;
  }

  /* slider thumb - chrome and safari */
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 13px;
    width: 13px;
    border-radius: 50%;
    background-color: #fff;
    border: 3px solid #687eaf;
    cursor: pointer;
    position: relative;
  }

  /* dragging thumb - chrome and safari */
  input[type="range"]:active::-webkit-slider-thumb {
    transform: scale(1.2);
  }

  /* slider thumb - firefox */
  input[type="range"]::-moz-range-thumb {
    height: 13px;
    width: 13px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    border: transparent;
    border: 3px solid #687eaf;
    position: relative;
  }
  /* dragging thumb - firefox */
  input[type="range"]:active::-moz-range-thumb {
    transform: scale(1.2);
  }
`
