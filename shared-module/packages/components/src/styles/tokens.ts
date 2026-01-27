import { injectGlobal } from "@emotion/css"

export const tokensGlobal = injectGlobal`
  :root {
    /* sizing */
    --control-gap: 0.5rem;
    --radius-control: 0.3rem;

    --control-height-sm: 2rem;
    --control-height-md: 2.5rem;
    --control-height-lg: 3rem;

    --control-pad-x-sm: 0.75rem;
    --control-pad-x-md: 1rem;
    --control-pad-x-lg: 1.25rem;

    --font-size-sm: 0.875rem;
    --font-size-md: 0.95rem;
    --font-size-lg: 1rem;

    /* focus ring */
    --focus-ring-width: 2px;
    --focus-ring-offset: 2px;
    --focus-ring-offset-color: transparent;
    --focus-ring-color: rgba(0, 120, 212, 0.6);

    /* disabled */
    --btn-disabled-opacity: 0.55;

    /* loading */
    --btn-loading-opacity: 0.8;

    /* pressed */
    --btn-pressed-offset: 0.5px;

    /* primary */
    --btn-primary-bg: #111;
    --btn-primary-fg: #fff;
    --btn-primary-border: transparent;
    --btn-primary-bg-hover: #000;
    --btn-primary-bg-pressed: #000;

    /* secondary */
    --btn-secondary-bg: #eee;
    --btn-secondary-fg: #111;
    --btn-secondary-border: transparent;
    --btn-secondary-bg-hover: #e4e4e4;
    --btn-secondary-bg-pressed: #dadada;

    /* tertiary */
    --btn-tertiary-bg: transparent;
    --btn-tertiary-fg: #111;
    --btn-tertiary-border: #d0d0d0;
    --btn-tertiary-bg-hover: rgba(0, 0, 0, 0.04);
    --btn-tertiary-bg-pressed: rgba(0, 0, 0, 0.06);
  }
`
