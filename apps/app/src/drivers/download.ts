// Export is web only; phones point to the web (docs/superpowers/specs/2026-10-28-account-delete-export-design.md).
export function download(_name: string, _text: string): void {
  throw new Error("download is web only");
}
