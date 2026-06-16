// ECMA-376 Agile Encryption decryption for password-protected .xlsx files.
// Spec: [MS-OFFCRYPTO] 2.3.4.10 / 2.3.4.13 / 2.3.4.14 / 2.3.4.15
// Uses only the Web Crypto API — no server round-trip, password never leaves browser.

// [MS-OFFCRYPTO] 2.3.4.13 — block key for deriving the actual key value
const BLOCK_KEY_FOR_KEY = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6])

// ── Helpers ──────────────────────────────────────────────────────────────────

function b64ToU8(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function le32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.length }
  return out
}

function padOrTrim(buf: Uint8Array, len: number): Uint8Array {
  if (buf.length === len) return buf
  const out = new Uint8Array(len)
  out.set(buf.subarray(0, Math.min(buf.length, len)))
  return out
}

function xor16(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(16)
  for (let i = 0; i < 16; i++) out[i] = a[i] ^ b[i]
  return out
}

function passwordToUtf16LE(pw: string): Uint8Array {
  const out = new Uint8Array(pw.length * 2)
  const dv = new DataView(out.buffer)
  for (let i = 0; i < pw.length; i++) dv.setUint16(i * 2, pw.charCodeAt(i), true)
  return out
}

// 'SHA512' → 'SHA-512', 'SHA1' → 'SHA-1'
function normHash(name: string): string {
  return name.replace(/^SHA(\d+)$/i, 'SHA-$1')
}

// Return a Uint8Array backed by a plain ArrayBuffer (required by SubtleCrypto APIs).
function plain(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new ArrayBuffer(u.length)
  new Uint8Array(out).set(u)
  return new Uint8Array(out)
}

async function digest(algo: string, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest(algo, plain(data)))
}

// ── XML attribute extraction ─────────────────────────────────────────────────

function attr(xml: string, attrName: string): string {
  const m = xml.match(new RegExp(`\\b${attrName}="([^"]*)"`, 'i'))
  return m?.[1] ?? ''
}

// Grab attributes from the first XML tag that contains a given attribute set.
function tagAttrs(xml: string, required: string): string {
  const m = xml.match(new RegExp(`<[^>]*\\b${required}\\b[^>]*>`, 'i'))
  return m?.[0] ?? ''
}

// ── Key derivation ────────────────────────────────────────────────────────────
// [MS-OFFCRYPTO] 2.3.4.13

async function deriveKeyBytes(
  salt: Uint8Array,
  password: string,
  spinCount: number,
  hashAlgo: string,
  keyBits: number,
  blockKey: Uint8Array,
): Promise<Uint8Array> {
  const algo = normHash(hashAlgo)
  let h = await digest(algo, concat(salt, passwordToUtf16LE(password)))
  for (let i = 0; i < spinCount; i++) h = await digest(algo, concat(le32(i), h))
  const derived = await digest(algo, concat(h, blockKey))
  return padOrTrim(derived, keyBits / 8)
}

// ── AES-CBC helpers ───────────────────────────────────────────────────────────

async function importAesKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', plain(keyBytes), 'AES-CBC', false, ['encrypt', 'decrypt'])
}

// Decrypt data that is zero-padded (NOT PKCS7). Web Crypto requires PKCS7, so we
// append a synthetic trailer block that decrypts to \x10×16 — a valid full-block
// PKCS7 padding — then strip it automatically via the decrypt call.
async function aesCbcDecryptNoPad(
  key: CryptoKey,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const lastCtBlock = data.subarray(data.length - 16)
  const trailerPlain = xor16(new Uint8Array(16).fill(0x10), lastCtBlock)

  // AES-ECB-encrypt(trailerPlain) = AES-CBC-encrypt(trailerPlain, iv=0)[0..16]
  const zeroIv = new Uint8Array(16)
  const ecbOut = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv: zeroIv }, key, plain(trailerPlain)),
  )
  const trailerCt = ecbOut.subarray(0, 16)

  const withTrailer = plain(concat(data, trailerCt))
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-CBC', iv: plain(iv) }, key, withTrailer),
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export class WrongExcelPasswordError extends Error {
  name = 'WrongExcelPasswordError'
}

export async function decryptAesExcel(
  buf: ArrayBuffer,
  password: string,
): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'AES decryption requires a secure context. ' +
      'Open the app via http://localhost:3000 instead of the LAN IP address.',
    )
  }

  const XLSX = await import('xlsx')

  // 1. Parse the OLE2 compound document
  const cfb = XLSX.CFB.read(new Uint8Array(buf), { type: 'array' })

  const infoEntry = XLSX.CFB.find(cfb, '/EncryptionInfo')
  const pkgEntry = XLSX.CFB.find(cfb, '/EncryptedPackage')
  if (!infoEntry?.content) throw new Error('Missing EncryptionInfo stream')
  if (!pkgEntry?.content) throw new Error('Missing EncryptedPackage stream')

  // 2. Parse EncryptionInfo XML
  // Stream layout: 2B major + 2B minor + 4B reserved = 8 bytes before the XML
  const infoBytes = infoEntry.content instanceof Uint8Array
    ? infoEntry.content
    : new Uint8Array(infoEntry.content as ArrayBuffer)
  const xml = new TextDecoder('utf-8').decode(infoBytes.subarray(8))

  const kdTag = tagAttrs(xml, 'saltValue') // first tag with saltValue = keyData
  const kdSalt    = b64ToU8(attr(kdTag, 'saltValue'))
  const kdBits    = Number(attr(kdTag, 'keyBits'))   || 256
  const kdBlock   = Number(attr(kdTag, 'blockSize')) || 16
  const kdHash    = attr(kdTag, 'hashAlgorithm')     || 'SHA512'

  const ekTag = tagAttrs(xml, 'encryptedKeyValue')  // encryptedKey element
  const ekSalt  = b64ToU8(attr(ekTag, 'saltValue'))
  const ekBits  = Number(attr(ekTag, 'keyBits'))    || 256
  const ekBlock = Number(attr(ekTag, 'blockSize'))  || 16
  const ekHash  = attr(ekTag, 'hashAlgorithm')      || 'SHA512'
  const ekSpin  = Number(attr(ekTag, 'spinCount'))  || 100000
  const ekEncKeyValue     = b64ToU8(attr(ekTag, 'encryptedKeyValue'))
  const ekEncVerifierHash = b64ToU8(attr(ekTag, 'encryptedVerifierHashValue'))
  const ekEncVerifierInput = b64ToU8(attr(ekTag, 'encryptedVerifierHashInput'))

  // 3. Derive key encryption key from password
  const keyEncKey = await deriveKeyBytes(ekSalt, password, ekSpin, ekHash, ekBits, BLOCK_KEY_FOR_KEY)
  const aesKeyEnc = await importAesKey(keyEncKey)

  // 4. Verify password by decrypting the verifier (avoids corrupted output on wrong pw)
  // [MS-OFFCRYPTO] 2.3.4.14
  const VERIFIER_INPUT_BLOCK  = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79])
  const VERIFIER_HASH_BLOCK   = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e])

  const verifierInputKey = await deriveKeyBytes(ekSalt, password, ekSpin, ekHash, ekBits, VERIFIER_INPUT_BLOCK)
  const verifierHashKey  = await deriveKeyBytes(ekSalt, password, ekSpin, ekHash, ekBits, VERIFIER_HASH_BLOCK)

  const verifierInputAes = await importAesKey(verifierInputKey)
  const verifierHashAes  = await importAesKey(verifierHashKey)

  const ivEk = padOrTrim(ekSalt, ekBlock)
  const decVerifierInput = await aesCbcDecryptNoPad(verifierInputAes, ivEk, ekEncVerifierInput)
  const decVerifierHash  = await aesCbcDecryptNoPad(verifierHashAes, ivEk, ekEncVerifierHash)
  const expectedHash = await digest(normHash(ekHash), decVerifierInput)

  if (!expectedHash.every((b, i) => b === decVerifierHash[i])) {
    throw new WrongExcelPasswordError()
  }

  // 5. Decrypt the actual encryption key
  const actualKey = (await aesCbcDecryptNoPad(aesKeyEnc, ivEk, ekEncKeyValue)).subarray(0, kdBits / 8)
  const aesData = await importAesKey(actualKey)

  // 6. Decrypt EncryptedPackage
  // Layout: 8-byte LE64 plaintext size, then 4096-byte encrypted segments
  const pkg = pkgEntry.content instanceof Uint8Array
    ? pkgEntry.content
    : new Uint8Array(pkgEntry.content as ArrayBuffer)

  const dv = new DataView(pkg.buffer, pkg.byteOffset, 8)
  const sizeLo = dv.getUint32(0, true)
  const sizeHi = dv.getUint32(4, true)
  const plainSize = sizeHi * 0x100000000 + sizeLo

  const SEGMENT = 4096
  const segments: Uint8Array[] = []
  let offset = 8
  let segIdx = 0

  while (offset < pkg.length) {
    const chunk = pkg.subarray(offset, offset + SEGMENT)
    const ivFull = await digest(normHash(kdHash), concat(kdSalt, le32(segIdx)))
    const iv = padOrTrim(ivFull, kdBlock)
    segments.push(await aesCbcDecryptNoPad(aesData, iv, chunk))
    offset += SEGMENT
    segIdx++
  }

  // Concatenate and truncate to exact size
  const out = new Uint8Array(plainSize)
  let pos = 0
  for (const seg of segments) {
    const take = Math.min(seg.length, plainSize - pos)
    if (take <= 0) break
    out.set(seg.subarray(0, take), pos)
    pos += take
  }
  return out
}
