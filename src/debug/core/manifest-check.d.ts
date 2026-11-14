// manifest-check.js 的型別（只在 Node 用：單元測試、同步腳本）。
export declare const MANIFEST_NAME: 'MANIFEST.json';
export interface CoreManifest {
  coreVersion: string;
  sourceCommit: string;
  sourceDirty: boolean;
  files: Record<string, string>;
}
export declare function hashContent(content: string | Uint8Array): string;
export declare function listCoreFiles(dir: string): string[];
export declare function buildManifest(dir: string, meta?: { sourceCommit?: string; sourceDirty?: boolean }): CoreManifest;
export declare function checkManifest(dir: string): {
  ok: boolean;
  missing: string[];
  extra: string[];
  changed: string[];
  versionMismatch: boolean;
  manifest: CoreManifest;
};
