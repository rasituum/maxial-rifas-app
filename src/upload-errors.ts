/** A safe upload failure that can be shown without disclosing paths or image data. */
export class UploadError extends Error {
  /** Carry a safe HTTP status and public message to the route error handler. */
  constructor(public status: number, message: string) { super(message); }
}
/** Write only an error category to the console; native decoders can include private metadata. */
export function traceUpload(category: string): void { console.error(`upload:${category}`); }
