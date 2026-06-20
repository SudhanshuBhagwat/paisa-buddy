import * as CryptoJS from 'crypto-js'
import * as XLSX from 'xlsx'

const BLOCK_KEY_FOR_KEY = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6])
const VERIFIER_INPUT_BLOCK = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79])
const VERIFIER_HASH_BLOCK = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e])
const DERIVE_YIELD_INTERVAL = 2000

export class WrongExcelPasswordError extends Error {
  constructor() {
    super('Wrong Excel password')
    this.name = 'WrongExcelPasswordError'
  }
}

export function isAgileEncryptedExcel(bytes: Uint8Array): boolean {
  if (!isOleContainer(bytes)) return false
  try {
    const cfb = XLSX.CFB.read(bytes, { type: 'array' })
    return !!XLSX.CFB.find(cfb, '/EncryptionInfo') && !!XLSX.CFB.find(cfb, '/EncryptedPackage')
  } catch {
    return false
  }
}

export async function decryptAgileExcel(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const cfb = XLSX.CFB.read(bytes, { type: 'array' })
  const infoEntry = XLSX.CFB.find(cfb, '/EncryptionInfo')
  const pkgEntry = XLSX.CFB.find(cfb, '/EncryptedPackage')
  if (!infoEntry?.content) throw new Error('Missing EncryptionInfo stream')
  if (!pkgEntry?.content) throw new Error('Missing EncryptedPackage stream')

  const infoBytes = toU8(infoEntry.content)
  const xml = bytesToUtf8(infoBytes.subarray(8))

  const kdTag = tagAttrs(xml, 'saltValue')
  const kdSalt = b64ToU8(attr(kdTag, 'saltValue'))
  const kdBits = Number(attr(kdTag, 'keyBits')) || 256
  const kdBlock = Number(attr(kdTag, 'blockSize')) || 16
  const kdHash = attr(kdTag, 'hashAlgorithm') || 'SHA512'

  const ekTag = tagAttrs(xml, 'encryptedKeyValue')
  const ekSalt = b64ToU8(attr(ekTag, 'saltValue'))
  const ekBits = Number(attr(ekTag, 'keyBits')) || 256
  const ekBlock = Number(attr(ekTag, 'blockSize')) || 16
  const ekHash = attr(ekTag, 'hashAlgorithm') || 'SHA512'
  const ekSpin = Number(attr(ekTag, 'spinCount')) || 100000
  const ekEncKeyValue = b64ToU8(attr(ekTag, 'encryptedKeyValue'))
  const ekEncVerifierHash = b64ToU8(attr(ekTag, 'encryptedVerifierHashValue'))
  const ekEncVerifierInput = b64ToU8(attr(ekTag, 'encryptedVerifierHashInput'))

  const keyBase = await deriveKeyBase(ekSalt, password, ekSpin, ekHash)
  const keyEncKey = finalizeDerivedKey(keyBase, ekHash, ekBits, BLOCK_KEY_FOR_KEY)
  const ivEk = padOrTrim(ekSalt, ekBlock)

  const verifierInputKey = finalizeDerivedKey(keyBase, ekHash, ekBits, VERIFIER_INPUT_BLOCK)
  const verifierHashKey = finalizeDerivedKey(keyBase, ekHash, ekBits, VERIFIER_HASH_BLOCK)
  const decVerifierInput = aesCbcDecryptNoPad(verifierInputKey, ivEk, ekEncVerifierInput)
  const decVerifierHash = aesCbcDecryptNoPad(verifierHashKey, ivEk, ekEncVerifierHash)
  const expectedHash = digest(normHash(ekHash), decVerifierInput)

  if (!startsWith(decVerifierHash, expectedHash)) {
    throw new WrongExcelPasswordError()
  }

  const actualKey = aesCbcDecryptNoPad(keyEncKey, ivEk, ekEncKeyValue).subarray(0, kdBits / 8)
  const pkg = toU8(pkgEntry.content)
  const dv = new DataView(pkg.buffer, pkg.byteOffset, 8)
  const sizeLo = dv.getUint32(0, true)
  const sizeHi = dv.getUint32(4, true)
  const plainSize = sizeHi * 0x100000000 + sizeLo

  const segments: Uint8Array[] = []
  let offset = 8
  let segIdx = 0
  while (offset < pkg.length) {
    const chunk = pkg.subarray(offset, offset + 4096)
    const ivFull = digest(normHash(kdHash), concat(kdSalt, le32(segIdx)))
    const iv = padOrTrim(ivFull, kdBlock)
    segments.push(aesCbcDecryptNoPad(actualKey, iv, chunk))
    offset += 4096
    segIdx++
    if (segIdx % 4 === 0) await yieldToJs()
  }

  const out = new Uint8Array(plainSize)
  let pos = 0
  for (const segment of segments) {
    const take = Math.min(segment.length, plainSize - pos)
    if (take <= 0) break
    out.set(segment.subarray(0, take), pos)
    pos += take
  }
  return out
}

function isOleContainer(bytes: Uint8Array): boolean {
  return bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
}

function toU8(content: Uint8Array | ArrayBuffer): Uint8Array {
  return content instanceof Uint8Array ? content : new Uint8Array(content)
}

function b64ToU8(raw: string): Uint8Array {
  const parsed = CryptoJS.enc.Base64.parse(raw)
  return wordArrayToU8(parsed)
}

function le32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function padOrTrim(buf: Uint8Array, len: number): Uint8Array {
  if (buf.length === len) return buf
  const out = new Uint8Array(len)
  out.set(buf.subarray(0, Math.min(buf.length, len)))
  return out
}

function passwordToUtf16LE(password: string): Uint8Array {
  const out = new Uint8Array(password.length * 2)
  const dv = new DataView(out.buffer)
  for (let i = 0; i < password.length; i++) {
    dv.setUint16(i * 2, password.charCodeAt(i), true)
  }
  return out
}

function normHash(name: string): string {
  return name.replace(/^SHA(\d+)$/i, 'SHA-$1').toUpperCase()
}

function digest(algo: string, data: Uint8Array): Uint8Array {
  const wordArray = u8ToWordArray(data)
  if (algo === 'SHA-1') return wordArrayToU8(CryptoJS.SHA1(wordArray))
  if (algo === 'SHA-256') return wordArrayToU8(CryptoJS.SHA256(wordArray))
  if (algo === 'SHA-384') return wordArrayToU8(CryptoJS.SHA384(wordArray))
  if (algo === 'SHA-512') return wordArrayToU8(CryptoJS.SHA512(wordArray))
  throw new Error(`Unsupported Excel hash algorithm: ${algo}`)
}

async function deriveKeyBase(
  salt: Uint8Array,
  password: string,
  spinCount: number,
  hashAlgo: string,
): Promise<Uint8Array> {
  const algo = normHash(hashAlgo)
  let h = digest(algo, concat(salt, passwordToUtf16LE(password)))
  for (let i = 0; i < spinCount; i++) {
    h = digest(algo, concat(le32(i), h))
    if (i > 0 && i % DERIVE_YIELD_INTERVAL === 0) await yieldToJs()
  }
  return h
}

function finalizeDerivedKey(
  baseHash: Uint8Array,
  hashAlgo: string,
  keyBits: number,
  blockKey: Uint8Array,
): Uint8Array {
  return padOrTrim(digest(normHash(hashAlgo), concat(baseHash, blockKey)), keyBits / 8)
}

function aesCbcDecryptNoPad(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: u8ToWordArray(data) } as CryptoJS.lib.CipherParams,
    u8ToWordArray(key),
    { iv: u8ToWordArray(iv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.NoPadding },
  )
  return wordArrayToU8(decrypted)
}

function attr(xml: string, attrName: string): string {
  const match = xml.match(new RegExp(`\\b${attrName}="([^"]*)"`, 'i'))
  return match?.[1] ?? ''
}

function tagAttrs(xml: string, required: string): string {
  const match = xml.match(new RegExp(`<[^>]*\\b${required}\\b[^>]*>`, 'i'))
  return match?.[0] ?? ''
}

function bytesToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes)
  }
  let encoded = ''
  for (const byte of bytes) {
    encoded += `%${byte.toString(16).padStart(2, '0')}`
  }
  return decodeURIComponent(encoded)
}

function startsWith(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length < right.length) return false
  for (let i = 0; i < right.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

function u8ToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = []
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] = (words[i >>> 2] ?? 0) | (bytes[i] << (24 - (i % 4) * 8))
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

function wordArrayToU8(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const { words, sigBytes } = wordArray
  const out = new Uint8Array(sigBytes)
  for (let i = 0; i < sigBytes; i++) {
    out[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
  }
  return out
}

function yieldToJs(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
