import {
  baseTheme,
  headingFont,
  monospaceFont,
  primaryFont,
  typography,
} from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

// Course material has no shared tokens for these; the values mirror main-frontend's
// ContentRenderer (fontSizeMapper defaults, link colours, quote colours, inline code).
const PARAGRAPH_FONT_SIZE = "20px"
const PARAGRAPH_FONT_SIZE_MOBILE = "18px"
const PARAGRAPH_LINE_HEIGHT = "160%"
const LINK_COLOR = "#1072ea"
const LINK_HOVER_COLOR = "#096df1"
const LINK_ACTIVE_COLOR = "#0870d9"
const LINK_VISITED_COLOR = "#8050f2"
const INLINE_CODE_BACKGROUND = "#e5e5e5"
const QUOTE_BACKGROUND = "#f6f8fa"
const QUOTE_BORDER_COLOR = "#bdc7d1"

/* The scope class is repeated below because Gutenberg's scope prefix has zero specificity, which
   would lose to the hand-written .editor-styles-wrapper rules in styles/Gutenberg/editor-styles.scss.
   It stays unprefixed thanks to the ignoredSelectors GutenbergEditor.tsx passes to transformStyles. */
const canvasCss = `
body,
.editor-styles-wrapper {
  font-family: ${primaryFont};
  font-size: ${PARAGRAPH_FONT_SIZE};
  line-height: ${PARAGRAPH_LINE_HEIGHT};
  color: ${baseTheme.colors.gray[1000]};
  text-underline-offset: 4.6px;
  text-decoration-thickness: 1.6px;
}

body p,
body li {
  font-size: ${PARAGRAPH_FONT_SIZE_MOBILE};
}

${respondToOrLarger.md} {
  body p,
  body li {
    font-size: ${PARAGRAPH_FONT_SIZE};
  }
}

body p {
  margin: 1.25rem 0;
  line-height: ${PARAGRAPH_LINE_HEIGHT};
}

body h1,
body h2,
body h3,
body h4,
body h5,
body h6 {
  font-family: ${headingFont};
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 1rem;
}

body h1 {
  font-size: ${typography.h3};
  line-height: 1.1;
  margin-top: 2.5rem;
}

body h2 {
  font-size: ${typography.h4};
  margin-top: 2rem;
}

body h3 {
  font-size: ${typography.h5};
  margin-top: 1.5rem;
}

body h4 {
  font-size: ${typography.h6};
  margin-top: 1.25rem;
}

body h5 {
  font-size: ${typography.h6};
  margin-top: 1rem;
}

body h6 {
  font-size: ${typography.h6};
  margin-top: 0.75rem;
}

body ul,
body ol {
  padding-inline-start: 2.5rem;
}

body li::marker {
  color: ${baseTheme.colors.gray[600]};
}

body a {
  color: ${LINK_COLOR};
}

body a:hover {
  color: ${LINK_HOVER_COLOR};
}

body a:active {
  color: ${LINK_ACTIVE_COLOR};
}

body a:visited {
  color: ${LINK_VISITED_COLOR};
}

body code,
body kbd,
body pre {
  font-family: ${monospaceFont};
}

body code:not(pre code) {
  background: ${INLINE_CODE_BACKGROUND};
  padding: 0 0.4rem 0.2rem 0.4rem;
  border-radius: 3px;
}

.wp-block-quote {
  margin: 2.5rem 0;
  padding: 0.4rem 1rem;
  border-left: 7px solid ${QUOTE_BORDER_COLOR};
  background: ${QUOTE_BACKGROUND};
}

.wp-block-quote cite {
  font-size: 0.8125rem;
  font-style: normal;
}
`

/**
 * Content styles for the editor canvas. Belongs both on `__unstableEditorStyles`' `styles` prop,
 * which is what renders them, and on `BlockEditorProvider`'s `settings.styles`, which is where block
 * previews read them from.
 *
 * Reproduces how main-frontend renders course material for learners, and restores what
 * `@wordpress/block-library/build-style/reset.css` reverts to browser defaults inside the canvas —
 * without these the canvas font falls back to serif.
 *
 * Gutenberg rewrites the `body` selectors here to the canvas scope, so nothing here reaches the
 * surrounding CMS UI. Keep the array module-level: the transformed CSS is cached per style object.
 */
export const editorContentStyles: readonly { css: string }[] = [{ css: canvasCss }]
