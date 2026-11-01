// Thrown for any failure reaching or using a model; routes show a friendly message.
export class AiUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The AI service is unavailable.", { cause });
    this.name = "AiUnavailableError";
  }
}
