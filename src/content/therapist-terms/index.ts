import TermsBodyV1, { version as v1, title as t1, sourceFileName as f1 } from './v1.0';

// Update this list when creating a new version
const VERSIONS = [
  { version: v1, title: t1, sourceFileName: f1, Body: TermsBodyV1 },
] as const;

export const LATEST = VERSIONS[VERSIONS.length - 1];
export const TERMS_VERSION = LATEST.version;
export const TERMS_TITLE = LATEST.title;
export const TERMS_SOURCE_FILE = LATEST.sourceFileName;
export const TermsBody = LATEST.Body;
