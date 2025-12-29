import { css } from "@emotion/css"

import { primaryFont } from "@/shared-module/common/styles"

export const headerTopRow = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
`

export const headerTitleWrap = css`
  flex: 1 1 auto;
  min-width: 0;
`

export const dropdownTop = css`
  background: #fff;
  border: 1px solid #e4e5e8;
  border-radius: 2px;
  width: 170px;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  font-size: 14px;
  color: #1a2333;
  cursor: pointer;
  margin-left: 24px;
  margin-top: 0;
  white-space: nowrap;
`

export const pageHeader = css`
  width: 1124px;
  margin: 32px auto 0 auto;
`

export const headerTopSection = css`
  width: 1124px;
  margin: 32px auto 0 auto;
`

export const headerControlsSection = css`
  max-width: 90vw;
  min-width: 900px;
  margin: 0 auto 0 auto;
`

export const title = css`
  font-family: ${primaryFont};
  font-weight: 500;
  font-size: 24px;
  line-height: 29px;
  color: #1a2333;
  margin-bottom: 8px;
`

export const chatbotInfo = css`
  font-family: ${primaryFont};
  font-size: 14px;
  font-weight: 400;
  line-height: 140%;
  color: #1a2333;
  opacity: 0.9;
  margin-bottom: 24px;
  max-width: 700px;
`

export const divider = css`
  border: none;
  border-top: 2px solid rgba(206, 209, 215, 0.5);
  margin-bottom: 28px;
`

export const controlsRow = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
`

export const dropdownIcon = css`
  margin-left: auto;
  color: #4e5562;
  font-size: 18px;
  transform: rotate(180deg);
`

export const searchBoxWrap = css`
  position: relative;
  width: 370px;
  height: 36px;
  margin-right: 18px;
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
  overflow: hidden;
  min-width: 0;
`

export const tab = css`
  padding: 0 20px;
  height: 36px;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-family: ${primaryFont};
  font-weight: 400;
  color: #1a2333;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  border-right: 1px solid #dbdbdb;
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
