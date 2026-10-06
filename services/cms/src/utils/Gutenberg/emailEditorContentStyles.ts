// Mirrors the `.email-content` rules and the inline styles in headless-lms
// `utils/src/email_layout_default.html` and `email_processor.rs`; keep them in sync. Selectors start
// with the canvas class, which GutenbergEditor leaves unprefixed, so they outrank block-library's CSS.
const ROOT = ".editor-styles-wrapper .is-root-container"

const emailCanvasCss = `
.editor-styles-wrapper {
  background-color: #F4F5F7;
}

${ROOT} {
  box-sizing: border-box;
  max-width: 640px;
  margin: 2.5rem auto 3rem;
  padding: 36px 40px 44px;
  background-color: #ffffff;
  border: 1px solid #DDDEE0;
  border-radius: 8px;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  line-height: 26px;
  color: #313947;
}

${ROOT} .wp-block,
${ROOT} .block-list-appender {
  max-width: none;
  margin-left: 0;
  margin-right: 0;
}

${ROOT} > :first-child { margin-top: 0 !important; }
${ROOT} > :last-child { margin-bottom: 0 !important; }

${ROOT} p { margin: 0 0 18px; font-size: 16px; line-height: 26px; overflow-wrap: anywhere; }
${ROOT} p.is-style-lead { font-size: 18px; line-height: 28px; }
${ROOT} p.is-style-code {
  padding: 16px;
  background-color: #F7F8F9;
  border: 1px solid #DDDEE0;
  border-radius: 6px;
  text-align: center;
  font-family: SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 28px;
  line-height: 36px;
  font-weight: 600;
  letter-spacing: 6px;
  color: #1A2333;
}
${ROOT} strong, ${ROOT} b { color: #1A2333; font-weight: 700; }

${ROOT} h1, ${ROOT} h2, ${ROOT} h3, ${ROOT} h4, ${ROOT} h5, ${ROOT} h6 {
  margin: 32px 0 12px;
  font-family: inherit;
  font-weight: 700;
  color: #1A2333;
  letter-spacing: -0.01em;
}
${ROOT} h1 { margin-bottom: 20px; font-size: 34px; line-height: 40px; font-weight: 800; letter-spacing: -0.02em; }
${ROOT} h2 { font-size: 24px; line-height: 30px; }
${ROOT} h3 { font-size: 19px; line-height: 26px; }
${ROOT} h4, ${ROOT} h5, ${ROOT} h6 { font-size: 16px; line-height: 24px; }

${ROOT} a { color: #065853; text-decoration: underline; overflow-wrap: anywhere; }

${ROOT} ul, ${ROOT} ol { margin: 0 0 18px; padding-left: 24px; }
${ROOT} li { margin: 0 0 8px; padding-left: 2px; font-size: 16px; line-height: 26px; }

${ROOT} .wp-block-image { margin: 0 0 18px; }
${ROOT} .wp-block-image img { display: block; max-width: 100%; height: auto; border-radius: 6px; }
${ROOT} .wp-block-image figcaption { margin: 8px 0 0; font-size: 14px; line-height: 20px; color: #535A66; text-align: left; }

${ROOT} .wp-block-table { margin: 0 0 18px; }
${ROOT} .wp-block-table table { width: auto; border-collapse: collapse; }
${ROOT} .wp-block-table th, ${ROOT} .wp-block-table td {
  padding: 10px 12px;
  border: 1px solid #DDDEE0;
  text-align: left;
  vertical-align: top;
  font-size: 15px;
  line-height: 22px;
}
${ROOT} .wp-block-table th { background-color: #F7F8F9; color: #1A2333; font-weight: 600; }
${ROOT} .wp-block-table figcaption { padding-bottom: 8px; font-size: 14px; color: #535A66; text-align: left; }

${ROOT} blockquote.wp-block-quote { margin: 0 0 18px; padding: 0 0 0 16px; border-left: 4px solid #DAE6E5; color: #535A66; }
${ROOT} blockquote.wp-block-quote p { color: #535A66; }
${ROOT} blockquote.wp-block-quote cite { display: block; margin: 0 0 4px; font-size: 14px; font-style: normal; }

${ROOT} .wp-block-spacer { margin: 0; }

${ROOT} hr.wp-block-separator { margin: 28px 0; border: 0; border-top: 1px solid #DDDEE0; opacity: 1; }

${ROOT} pre.wp-block-code {
  margin: 0 0 18px;
  padding: 12px 16px;
  background-color: #F7F8F9;
  border: 1px solid #DDDEE0;
  border-radius: 6px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 14px;
  line-height: 20px;
  color: #1A2333;
}
${ROOT} pre.wp-block-code code { font-family: inherit; font-size: inherit; }

/* The email renders each button as its own table, so they stack. */
${ROOT} .wp-block-buttons {
  margin: 28px 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
${ROOT} .wp-block-button { margin: 0; }
${ROOT} .wp-block-button .wp-block-button__link {
  display: inline-block;
  padding: 14px 26px;
  border: 0;
  border-radius: 6px;
  background-color: #1F6964;
  color: #FFFFFF;
  font-size: 16px;
  line-height: 20px;
  font-weight: 600;
  text-decoration: none;
}
/* The email writes this arrow as text, so it is not part of the editable button label. */
${ROOT} .wp-block-button.is-style-arrow .wp-block-button__link::after { content: "\\00a0\\2192"; }

${ROOT} [data-type="moocfi/email-callout"] { margin: 28px 0; }
${ROOT} [data-type="moocfi/email-callout"] p,
${ROOT} [data-type="moocfi/email-callout"] li { margin: 0 0 6px; font-size: 15px; line-height: 24px; }
${ROOT} [data-type="moocfi/email-callout"] .wp-block:last-child,
${ROOT} [data-type="moocfi/email-callout"] p:last-child { margin-bottom: 0; }
${ROOT} [data-type="moocfi/email-callout"] .wp-block-buttons { margin: 14px 0 0; }
`

/** Canvas styles for the email editor, in place of `editorContentStyles`; kept module-level for the same caching reason. */
export const emailEditorContentStyles: readonly { css: string }[] = [{ css: emailCanvasCss }]
