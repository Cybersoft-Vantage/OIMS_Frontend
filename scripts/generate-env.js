const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mode = process.argv[2] === 'production' ? 'production' : 'development';
const envFileName = mode === 'production' ? '.env.production' : '.env';
const envPath = path.join(root, envFileName);
const defaultApiUrl = mode === 'production' ? 'http://169.58.61.53:8081/api' : 'http://127.0.0.1:8000/api';

function parseEnv(content) {
  return content.split(/\r?\n/).reduce((env, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return env;
    }

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) {
      return env;
    }

    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
    return env;
  }, {});
}

let values = {};
if (fs.existsSync(envPath)) {
  values = parseEnv(fs.readFileSync(envPath, 'utf8'));
} else {
  console.warn(`Warning: ${envFileName} not found in ${root}. Using defaults.`);
}

const apiUrl = values.API_URL || defaultApiUrl;
const targetPath = path.join(root, 'src', 'environments', mode === 'production' ? 'environment.prod.ts' : 'environment.ts');
const relativePackageImport = '../../package.json';
const content = `/**\n` +
  ` * This file is generated from ${envFileName}.\n` +
  ` * Run \"npm run generate-env\" or \"npm run generate-env:prod\" before building.\n` +
  ` */\n\n` +
  `import packageInfo from '${relativePackageImport}';\n\n` +
  `export const environment = {\n` +
  `  appVersion: packageInfo.version,\n` +
  `  production: ${mode === 'production'},\n` +
  `  apiUrl: '${apiUrl}'\n` +
  `};\n`;

fs.writeFileSync(targetPath, content, 'utf8');
console.log(`Generated ${path.relative(root, targetPath)} from ${path.relative(root, envPath)} (${apiUrl})`);
