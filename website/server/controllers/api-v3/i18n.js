import _ from 'lodash';
import nconf from 'nconf';
import {
  availableLanguages,
  BROWSER_SCRIPT_CACHE_PATH,
  geti18nBrowserScript,
} from '../../libs/i18n';

const IS_PROD = nconf.get('IS_PROD');

const api = {};

/**
 * @api {get} /api/v3/i18n/browser-script Returns the i18n JS script.
 * @apiDescription Returns the i18n JS script to make
 * all the i18n strings available in the browser under window.i18n.strings.
 * Does not require authentication.
 * @apiName i18nBrowserScriptGet
 * @apiGroup i18n
 */
api.geti18nBrowserScript = {
  method: 'GET',
  url: '/i18n/browser-script',
  async handler (req, res) {
    const language = _.find(availableLanguages, { code: req.language });

    if (IS_PROD) {
      res.sendFile(`${BROWSER_SCRIPT_CACHE_PATH}${language}.json`);
    } else {
      res.set({
        'Content-Type': 'application/json',
      });

      const jsonResString = geti18nBrowserScript(language);
      res.status(200).send(jsonResString);
    }
  },
};

export default api;
