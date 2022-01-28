export enum ProgressMode {
  Determinate = 'DETERMINATE',
  Indeterminate = 'INDETERMINATE',
  Buffer = 'BUFFER',
  Query = 'QUERY',
}

export interface ProgressArguments {
  mode?: ProgressMode;
  /**
   * An optional number between 0 and 1 (inclusive) indicating percentage.
   */
  value?: number;
  status?: string;
}

/**
 * Holds a progress update
 */
export class Progress {
  public mode: ProgressMode;
  public value: number;
  public status: string;

  constructor(args: ProgressArguments = {
    mode: ProgressMode.Indeterminate,
    value: 0,
    status: 'Working...'
  }) {
    this.mode = args.mode;
    this.value = args.value;
    this.status = args.status;
  }
}
