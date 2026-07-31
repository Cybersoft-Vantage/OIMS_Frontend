/**
 * This file is generated from .env.production.
 * Run "npm run generate-env" or "npm run generate-env:prod" before building.
 */

import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'http://169.58.61.53:8081/api'
};
