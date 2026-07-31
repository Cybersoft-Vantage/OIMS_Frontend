/**
 * This file is generated from .env.
 * Run "npm run generate-env" or "npm run generate-env:prod" before building.
 */

import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: false,
  apiUrl: 'http://127.0.0.1:8000'
};
