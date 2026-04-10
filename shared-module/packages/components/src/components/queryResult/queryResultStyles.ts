import { css, keyframes } from "@emotion/css"

export type ThemeMode = "light" | "dark"

const shimmer = keyframes`
  0% { transform: translateX(-130%); }
  100% { transform: translateX(130%); }
`

const progressBeam = keyframes`
  0% { transform: translateX(-120%); }
  100% { transform: translateX(420%); }
`

export const wrapperCss = css`
  position: relative;
  isolation: isolate;
`

export const surfaceFrameCss = css`
  position: relative;
  border-radius: calc(var(--space-4) + var(--space-1));
  overflow: hidden;
`

export const initialLoadingSurfaceLightCss = css`
  background: var(--query-skeleton-surface-light);
  border: var(--query-border-width) solid var(--query-skeleton-surface-border-light);
`

export const initialLoadingSurfaceDarkCss = css`
  background: var(--query-skeleton-surface-dark);
  border: var(--query-border-width) solid var(--query-skeleton-surface-border-dark);
`

export const initialLoadingSurfaceCss = css`
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: calc(var(--space-4) + var(--space-1));
`

/** Dynamic min-height for the initial loading panel. */
export function loadingSurfaceMinHeightCss(minHeightPx: number) {
  return css`
    min-height: ${minHeightPx}px;
  `
}

/** Dynamic skeleton block dimensions. */
export function skeletonBlockDimsCss(widthValue: string, heightPx: number) {
  return css`
    width: ${widthValue};
    height: ${heightPx}px;
  `
}

export const skeletonBlocksCss = css`
  position: absolute;
  inset: 0;
  padding: calc(var(--space-4) + var(--space-1));
  display: grid;
  gap: calc(var(--space-3) + var(--space-2));
  align-content: start;
`

const shimmerGradient = `
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--query-shimmer-edge) 35%,
    var(--query-shimmer-mid) 50%,
    var(--query-shimmer-edge) 65%,
    transparent 100%
  );
`

export const skeletonBlockLightCss = css`
  background: var(--query-skeleton-block-light);

  &::after {
    ${shimmerGradient}
  }
`

export const skeletonBlockDarkCss = css`
  background: var(--query-skeleton-block-dark);

  &::after {
    ${shimmerGradient}
  }
`

export const skeletonBlockBaseCss = css`
  border-radius: calc(var(--space-3) + var(--space-2));
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    animation: ${shimmer} var(--query-shimmer-duration) linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
    }
  }
`

export const initialLoadingCenterCss = css`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
`

export const topProgressTrackLightCss = css`
  background: var(--query-progress-track-light);

  &::after {
    background: linear-gradient(90deg, transparent, var(--query-progress-beam-light), transparent);
  }
`

export const topProgressTrackDarkCss = css`
  background: var(--query-progress-track-dark);

  &::after {
    background: linear-gradient(90deg, transparent, var(--query-progress-beam-dark), transparent);
  }
`

export const topProgressCss = css`
  position: absolute;
  inset: 0 0 auto 0;
  height: var(--space-1);
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    width: 28%;
    animation: ${progressBeam} var(--query-progress-beam-duration) linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
    }
  }
`

export const refreshOverlayCss = css`
  position: absolute;
  inset: 0;
  pointer-events: none;
  backdrop-filter: blur(var(--query-overlay-blur));
`

export const bannerCss = css`
  margin-bottom: calc(var(--space-3) + var(--space-2));
`

export const animatedContentCss = css`
  transition: var(--query-content-transition);
`

export const animatedContentRefreshingCss = css`
  filter: blur(var(--query-refresh-blur));
  opacity: var(--query-refresh-content-opacity);
  transform: scale(var(--query-refresh-content-scale));
`

export const errorTextCss = css`
  margin: 0 0 var(--space-3);
`

export const errorStackCss = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
`

export const blockingErrorCss = css`
  padding: var(--space-4);
  border-radius: calc(var(--space-3) + var(--space-2));
  border: var(--query-border-width) solid var(--field-border-color-invalid);
  background: var(--color-crimson-25);
`

export const staleStatusCss = css`
  font-size: var(--font-size-1);
  color: var(--field-message-color-invalid);
`

const querySpin = keyframes`
  to { transform: rotate(360deg); }
`

export const queryLoadingSpinnerCss = css`
  width: var(--space-5);
  height: var(--space-5);
  border-radius: 50%;
  border: var(--space-1) solid var(--color-green-600);
  border-right-color: transparent;
  animation: ${querySpin} var(--query-spinner-duration) linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`
