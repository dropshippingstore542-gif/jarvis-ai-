import parser from "cron-parser";

export class InvalidCronExpressionError extends Error {
  constructor(expression: string, cause: unknown) {
    super(
      `Invalid cron expression "${expression}": ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = "InvalidCronExpressionError";
  }
}

/** Throws InvalidCronExpressionError if the expression can't be parsed. */
export function validateCronExpression(expression: string): void {
  try {
    parser.parseExpression(expression);
  } catch (err) {
    throw new InvalidCronExpressionError(expression, err);
  }
}

/** Standard 5-field cron, evaluated in the server's local timezone. */
export function computeNextRun(expression: string, from: Date = new Date()): string {
  try {
    const interval = parser.parseExpression(expression, { currentDate: from });
    return interval.next().toISOString();
  } catch (err) {
    throw new InvalidCronExpressionError(expression, err);
  }
}
