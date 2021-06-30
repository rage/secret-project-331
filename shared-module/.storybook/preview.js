
import { MINIMAL_VIEWPORTS} from '@storybook/addon-viewport';

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

export const parameters = {
  viewport: {
    viewports: {
       ...MINIMAL_VIEWPORTS,
      ...customViewports,
    },
  },
};
