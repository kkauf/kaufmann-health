import TermsBodyV1, { version as v1, title as t1, sourceFileName as f1 } from './v1.0';
import TermsBodyV2, { version as v2, title as t2, sourceFileName as f2 } from './v2.0';

// Update this list when creating a new version
const VERSIONS = [
  { version: v1, title: t1, sourceFileName: f1, Body: TermsBodyV1 },
  { version: v2, title: t2, sourceFileName: f2, Body: TermsBodyV2 },
] as const;

export const LATEST = VERSIONS[VERSIONS.length - 1];
export const TERMS_VERSION = LATEST.version;
export const TERMS_TITLE = LATEST.title;
export const TERMS_SOURCE_FILE = LATEST.sourceFileName;
export const TermsBody = LATEST.Body;

export function getTermsVersion(version: string) {
  return VERSIONS.find(v => v.version === version);
}

export function getAllTermsVersions() {
  return VERSIONS;
}
