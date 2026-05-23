export interface StorageProvider {
  upload(key: string, data: Buffer, mimeType: string): Promise<string> // returns URL
  delete(key: string): Promise<void>
}
