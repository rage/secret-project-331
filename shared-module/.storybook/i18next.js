import {initReactI18next} from 'react-i18next';
import i18n from 'i18next';

const ns = ['shared-module'];
const supportedLngs = ['en', 'fi'];

i18n.use(initReactI18next)
    .init({
        //debug: true,
        lng: 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        defaultNS: 'shared-module',
        ns,
        supportedLngs,
    });

supportedLngs.forEach((language) => {
    ns.forEach((namespace) => {
        i18n.addResources(
          language,
          namespace,
            require(`../src/locales/${language}/${namespace}.json`)
        );
    });
});

export {i18n};
