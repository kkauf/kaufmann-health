import { version as v1, title as t1, date as d1, sourceFileName as f1 } from './v1.0.meta';
import { version as v2, title as t2, date as d2, sourceFileName as f2 } from './v2.0.meta';

export interface DatenschutzVersion {
  version: string;
  title: string;
  date: string;
  sourceFileName: string;
}

// Update this list when creating a new version
const VERSIONS: DatenschutzVersion[] = [
  { version: v1, title: t1, date: d1, sourceFileName: f1 },
  { version: v2, title: t2, date: d2, sourceFileName: f2 },
];

export const LATEST = VERSIONS[VERSIONS.length - 1];
export const DATENSCHUTZ_VERSION = LATEST.version;
export const DATENSCHUTZ_TITLE = LATEST.title;
export const DATENSCHUTZ_DATE = LATEST.date;
export const DATENSCHUTZ_SOURCE_FILE = LATEST.sourceFileName;

export function getDatenschutzVersion(version: string): DatenschutzVersion | undefined {
  return VERSIONS.find(v => v.version === version);
}

export function getAllDatenschutzVersions(): DatenschutzVersion[] {
  return VERSIONS;
}
