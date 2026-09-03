import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface PackageJson {
  version?: unknown;
}

export interface BuildInfo {
  version: string;
  gitHead: string;
}

function readBackendVersion(): string {
  try {
    const packageJsonPath = resolve(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
    return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
  } catch {
    return 'unknown';
  }
}
const backendVersion = readBackendVersion();
export function getBuildInfo(): BuildInfo {
  return {
    version: backendVersion,
    gitHead: process.env.GIT_COMMIT_SHA?.trim() || 'dev',
  };
}
