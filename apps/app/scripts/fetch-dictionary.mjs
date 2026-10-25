// Puts the published dictionary pack into assets before a build. The pack is
// CC BY-SA and not in git (docs/decisions/0004-sozluk-kaynaklari.md).
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const TAG = "dictionary-v1";
const SOURCE = `https://github.com/ismailcelik-tr/dilkart/releases/download/${TAG}/${TAG}.sqlite.gz`;
const GZ_SHA256 = "57ed61c8b5e587e84d077eaebbdc7de80c82bab6a128858c1c9db5444d7c3591";
const SQLITE_SHA256 = "7c7cd55d30de310583d8f53d83722027cb486b424400c7a3e02a51605db5d50d";
const OUT = new URL("../assets/dictionary/dictionary.sqlite", import.meta.url);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function current() {
  try {
    return sha256(await readFile(OUT));
  } catch {
    return undefined;
  }
}

if ((await current()) === SQLITE_SHA256) {
  console.log(`${TAG} already in place`);
  process.exit(0);
}

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`${SOURCE}: HTTP ${response.status}`);
}
const gz = Buffer.from(await response.arrayBuffer());
if (sha256(gz) !== GZ_SHA256) {
  throw new Error(`${TAG}: download checksum mismatch`);
}
const pack = gunzipSync(gz);
if (sha256(pack) !== SQLITE_SHA256) {
  throw new Error(`${TAG}: unpacked checksum mismatch`);
}

await mkdir(new URL(".", OUT), { recursive: true });
await writeFile(OUT, pack);
console.log(`${TAG}: ${(pack.length / 1e6).toFixed(1)} MB written`);
