import { css } from "@emotion/css"

import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const headerTopRow = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  gap: 12px;

  ${respondToOrLarger.md} {
    flex-direction: row;
    gap: 0;
  }
`

export const headerTitleWrap = css`
  flex: 1 1 auto;
  min-width: 0;
`

export const dropdownTop = css`
  background: #fff;
  border: 1px solid #e4e5e8;
  border-radius: 2px;
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
  color: #1a2333;
  cursor: pointer;
  margin-left: 0;
  margin-top: 0;
  white-space: nowrap;

  ${respondToOrLarger.md} {
    width: 170px;
    font-size: 14px;
    padding: 0 14px;
    margin-left: 24px;
  }
`

export const pageHeader = css`
  width: 1124px;
  margin: 32px auto 0 auto;
`

export const headerTopSection = css`
  width: 100%;
  max-width: 100%;
  margin: 16px auto 0 auto;
  padding: 0 16px;

  ${respondToOrLarger.md} {
    margin: 24px auto 0 auto;
    padding: 0 24px;
  }

  ${respondToOrLarger.lg} {
    width: 1124px;
    max-width: 1124px;
    margin: 32px auto 0 auto;
    padding: 0;
  }
`

export const headerControlsSection = css`
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0 16px;

  ${respondToOrLarger.md} {
    padding: 0 24px;
    max-width: 95vw;
    min-width: 0;
  }

  ${respondToOrLarger.lg} {
    max-width: 90vw;
    min-width: 600px;
    padding: 0;
  }

  ${respondToOrLarger.xl} {
    min-width: 900px;
  }
`

export const title = css`
  font-family: ${primaryFont};
  font-weight: 500;
  font-size: 20px;
  line-height: 24px;
  color: #1a2333;
  margin-bottom: 6px;

  ${respondToOrLarger.md} {
    font-size: 24px;
    line-height: 29px;
    margin-bottom: 8px;
  }
`

export const chatbotInfo = css`
  font-family: ${primaryFont};
  font-size: 12px;
  font-weight: 400;
  line-height: 140%;
  color: #1a2333;
  opacity: 0.9;
  margin-bottom: 16px;
  max-width: 100%;

  ${respondToOrLarger.md} {
    font-size: 14px;
    margin-bottom: 20px;
    max-width: 700px;
  }

  ${respondToOrLarger.lg} {
    margin-bottom: 24px;
  }
`

export const divider = css`
  border: none;
  border-top: 2px solid rgba(206, 209, 215, 0.5);
  margin-bottom: 16px;

  ${respondToOrLarger.md} {
    margin-bottom: 24px;
  }

  ${respondToOrLarger.lg} {
    margin-bottom: 28px;
  }
`

export const controlsRow = css`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  ${respondToOrLarger.md} {
    flex-direction: row;
    align-items: center;
    gap: 0;
    margin-bottom: 18px;
  }
`

export const dropdownIcon = css`
  margin-left: auto;
  color: #4e5562;
  font-size: 18px;
  transform: rotate(180deg);
`

export const searchBoxWrap = css`
  position: relative;
  width: 100%;
  height: 36px;
  margin-right: 0;

  ${respondToOrLarger.md} {
    width: 300px;
    margin-right: 12px;
  }

  ${respondToOrLarger.lg} {
    width: 370px;
    margin-right: 18px;
  }
`

export const searchInput = css`
  width: 100%;
  height: 36px;
  border: 1px solid #dbdbdb;
  border-radius: 4px;
  padding-left: 36px;
  font-size: 14px;
  font-family: ${primaryFont};
  color: #1a2333;
  background: #fff;
`

export const searchIcon = css`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #5c5f64;
  font-size: 16px;
  opacity: 0.8;
`

export const tabsWrap = css`
  display: flex;
  align-items: center;
  background: rgba(6, 88, 83, 0.05);
  border-radius: 2px;
  height: 36px;
  border: 1px solid #dbdbdb;
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  -webkit-overflow-scrolling: touch;

  ${respondToOrLarger.md} {
    overflow: hidden;
  }
`

export const tab = css`
  padding: 0 12px;
  height: 36px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-family: ${primaryFont};
  font-weight: 400;
  color: #1a2333;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  border-right: 1px solid #dbdbdb;
  white-space: nowrap;
  flex-shrink: 0;

  ${respondToOrLarger.md} {
    padding: 0 16px;
    font-size: 14px;
  }

  ${respondToOrLarger.lg} {
    padding: 0 20px;
  }
`

export const tabLast = css`
  border-right: none;
`

export const tabActive = css`
  color: #065853;
  background: #fff;
`

export const tabCompletions = css`
  color: #065853;
`

export const container = css`
  width: 1124px;
  margin: 0 auto 0 auto;
  background: #fff;
  border: 1px solid #ced1d7;
  border-radius: 8px 8px 0 0;
  font-family: ${primaryFont};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`
