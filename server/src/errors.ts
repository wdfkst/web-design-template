/** Anything the HTTP layer can turn into a 4xx without leaking internals. */
export class ServerError extends Error {
  readonly statusCode: number
  readonly detail?: string

  constructor(message: string, statusCode = 400, detail?: string) {
    super(message)
    this.name = 'ServerError'
    this.statusCode = statusCode
    if (detail !== undefined) this.detail = detail
  }
}
