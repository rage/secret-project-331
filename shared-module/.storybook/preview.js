
import { MINIMAL_VIEWPORTS} from '@storybook/addon-viewport';
import GlobalStyles from "../src/styles/GlobalStyles"
import * as nextImage from 'next/image';
import {i18n} from './i18next.js';

const customViewports = {
  Laptop: {
    name: 'Laptop',
    styles: {
      width: '769px',
      height: '963px',
    },
  },
  Desktop: {
    name: 'Desktop',
    styles: {
      width: '1025px',
      height: '963px',
    },
  },
  XLSCreen: {
    name: 'Extra large screen',
    styles: {
      width: '1201px',
      height: '801px',
    },
  },
};

Object.defineProperty(nextImage, 'default', {
  configurable: true,
  value: props => <img {...props} />
});

// Global decorator to apply the styles to all stories
export const decorators = [
  Story => (
    <>
      <GlobalStyles />
      {Story()}
    </>
  ),
];

export const parameters = {
  i18n,
  locale: 'en',
  locales: {
    en: 'English',
    fi: 'Finnish',
  },
  viewport: {
    viewports: {
       ...MINIMAL_VIEWPORTS,
      ...customViewports,
    },
  },
};
