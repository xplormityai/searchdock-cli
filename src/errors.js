export class SearchDockError extends Error {
  constructor(message, code = 'SEARCHDOCK_ERROR') {
    super(message);
    this.name = 'SearchDockError';
    this.code = code;
  }
}

export function publicError(error) {
  return error instanceof SearchDockError ? error.message : 'The operation failed. Check your configuration and try again.';
}
