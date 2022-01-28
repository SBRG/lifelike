export class UserError {
  constructor(public readonly title,
              public readonly message,
              public readonly additionalMsgs,
              public readonly stacktrace = null,
              public readonly cause = null,
              public readonly transactionId = null) {
  }
}
