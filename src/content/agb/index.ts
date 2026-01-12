import { version as v1, title as t1, date as d1, sourceFileName as f1 } from './v1.0.meta';
import { version as v2, title as t2, date as d2, sourceFileName as f2 } from './v2.0.meta';

export interface AgbVersion {
  version: string;
  title: string;
  date: string;
  sourceFileName: string;
}

// Update this list when creating a new version
const VERSIONS: AgbVersion[] = [
  { version: v1, title: t1, date: d1, sourceFileName: f1 },
  { version: v2, title: t2, date: d2, sourceFileName: f2 },
];

export const LATEST = VERSIONS[VERSIONS.length - 1];
export const AGB_VERSION = LATEST.version;
export const AGB_TITLE = LATEST.title;
export const AGB_DATE = LATEST.date;
export const AGB_SOURCE_FILE = LATEST.sourceFileName;

export function getAgbVersion(version: string): AgbVersion | undefined {
  return VERSIONS.find(v => v.version === version);
}

export function getAllAgbVersions(): AgbVersion[] {
  return VERSIONS;
}
