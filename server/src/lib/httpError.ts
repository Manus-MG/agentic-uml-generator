/** An error that already knows what status code it should produce. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail: unknown = null,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, detail?: unknown) => new HttpError(400, message, detail ?? null);
export const notFound = (message: string) => new HttpError(404, message);
