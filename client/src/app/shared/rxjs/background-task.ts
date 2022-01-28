import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { merge, isObject } from 'lodash-es';
import Timer = NodeJS.Timer;

export enum TaskState {
  Idle = 'idle',
  Delaying = 'delaying',
  Running = 'running',
  Retrying = 'retrying',
  RetryLimitExceeded = 'retry_limit_exceeded',
}

function isRunningState(state: TaskState) {
  return state !== TaskState.Idle && state !== TaskState.RetryLimitExceeded;
}

export interface BackgroundTaskOptions<T, R> {
  reducer?: (accumulator: T, value: T) => T;
  initialDelay?: number;
  delay?: number;
  retryInitialDelay?: number;
  retryDelayMultiplier?: number;
  retryMaxDelay?: number;
  retryMaxCount?: number;
  delayedRunningInitialDelay?: number;
  delayedRunningMinimumLength?: number;
}

export interface TaskResult<T, R> {
  result: R;
  value: T;
}

export interface TaskStatus {
  state: TaskState;
  running: boolean;
  delayedRunning: boolean;
  loaded: boolean;
  placeholdersShown: boolean;
  progressShown: boolean;
  emptyResultsShown: boolean;
  retryInProgressShown: boolean;
  failedErrorShown: boolean;
  resultsShown: boolean;
  error: any;
}

/**
 * Manages calls to a one-shot subscription.
 */
export class BackgroundTask<T, R> {
  readonly initialDelay = 500;
  readonly delay = 500;
  readonly retryInitialDelay = 3000;
  readonly retryDelayMultiplier = 1.5;
  readonly retryMaxDelay = 1000 * 60;
  readonly retryMaxCount = 0;
  readonly delayedRunningInitialDelay = 0;
  readonly delayedRunningMinimumLength = 500;

  public values$ = new Subject<T>();
  public status$ = new BehaviorSubject<TaskStatus>({
    state: TaskState.Idle,
    running: false,
    delayedRunning: false,
    loaded: false,
    placeholdersShown: true,
    progressShown: false,
    emptyResultsShown: false,
    retryInProgressShown: false,
    failedErrorShown: false,
    resultsShown: false,
    error: null,
  });
  public results$ = new Subject<TaskResult<T, R>>();
  public errors$ = new Subject<any>();

  private started = false;
  private currentState: TaskState = TaskState.Idle;
  private futureValue = null;
  private futureRunQueued = false;
  private retryCount = 0;

  public pendingValue: T = null;
  public latestSuccessfulValue: T = null;
  private initialRunCompleted = false;
  private error = false;
  private latestError: any;

  private delayedRunning = false;
  private delayedRunningStartTime: number | undefined;
  private delayedRunningTimer: any;
  private delayedRunningClearTimer: any;

  readonly reducer: (newData: T, existingData: T) => T = ((newData, existingData) => {
    if (existingData == null || newData == null) {
      return newData;
    } else if (isObject(newData) && isObject(existingData)) {
      return merge(existingData, newData);
    } else if (isObject(existingData)) {
      throw new Error('default reducer function does not know how to combine non-object new data with existing object data');
    } else {
      return newData;
    }
  });

  constructor(private readonly project: (value: T) => Observable<R>,
              options: BackgroundTaskOptions<T, R> = {}) {
    Object.assign(this, options);
  }

  get state() {
    return this.currentState;
  }

  set state(state: TaskState) {
    const running = isRunningState(state);
    if (running !== isRunningState(this.state)) {
      if (running) {
        this.startDelayedRunning();
      } else {
        this.clearDelayedRunning();
      }
    }
    this.currentState = state;
  }

  private nextStatus() {
    const running = isRunningState(this.state);

    this.status$.next({
      state: this.state,
      loaded: this.initialRunCompleted,
      running,
      delayedRunning: this.delayedRunning,
      placeholdersShown: running,
      progressShown: false,
      resultsShown: !running,
      emptyResultsShown: !running,
      failedErrorShown: this.state === TaskState.RetryLimitExceeded,
      retryInProgressShown: this.error && this.state !== TaskState.RetryLimitExceeded,
      error: this.latestError,
    });
  }

  private startDelayedRunning() {
    if (this.delayedRunningClearTimer != null) {
      clearTimeout(this.delayedRunningClearTimer);
      this.delayedRunningClearTimer = null;
    }

    if (this.delayedRunningTimer != null) {
      clearTimeout(this.delayedRunningTimer);
      this.delayedRunningTimer = null;
    }

    this.delayedRunningTimer = setTimeout(() => {
      this.delayedRunningTimer = null;
      this.delayedRunning = true;
      this.delayedRunningStartTime = window.performance.now();
      this.nextStatus();
    }, this.delayedRunningInitialDelay);
  }

  private clearDelayedRunning() {
    if (this.delayedRunningClearTimer != null) {
      clearTimeout(this.delayedRunningClearTimer);
      this.delayedRunningClearTimer = null;
    }

    if (this.delayedRunningTimer != null) {
      clearTimeout(this.delayedRunningTimer);
      this.delayedRunningTimer = null;
    } else if (this.delayedRunning) {
      const timeRemaining = this.delayedRunningMinimumLength - (window.performance.now() - this.delayedRunningStartTime);
      if (timeRemaining <= 0) {
        this.delayedRunning = false;
        this.nextStatus();
      } else {
        this.delayedRunningClearTimer = setTimeout(() => {
          this.delayedRunningClearTimer = null;
          this.clearDelayedRunning();
        }, timeRemaining);
      }
    }
  }

  private startRun() {
    const pendingValue = this.futureValue;

    this.state = TaskState.Running;
    this.futureRunQueued = false;
    this.futureValue = null;
    this.pendingValue = pendingValue;
    this.nextStatus();

    // We're assuming it's a one-shot observable
    this.project(pendingValue).subscribe(
      result => {
        this.initialRunCompleted = true;
        this.error = false;
        this.retryCount = 0;

        if (this.futureRunQueued) {
          this.pendingValue = this.futureValue;
          this.state = TaskState.Delaying;
          setTimeout(this.startRun.bind(this), this.delay);
        } else {
          this.state = TaskState.Idle;
        }

        this.nextStatus();

        this.latestSuccessfulValue = pendingValue;
        this.results$.next({
          result,
          value: pendingValue,
        });
      },
      error => {
        const retrying = this.retryCount < this.retryMaxCount;

        // Since it failed, merge new data with failed data
        this.futureValue = this.futureRunQueued ? this.reducer(this.futureValue, pendingValue) : pendingValue;
        this.pendingValue = this.futureValue;

        this.error = true;

        if (retrying) {
          const delay = Math.min(this.retryMaxDelay, this.retryInitialDelay
            * Math.pow(this.retryDelayMultiplier, this.retryCount));
          this.retryCount++;
          this.state = TaskState.Retrying;
          this.nextStatus();
          setTimeout(this.startRun.bind(this), delay);
        } else {
          this.state = TaskState.RetryLimitExceeded;
          this.errors$.next(error);
          this.latestError = error;
          this.nextStatus();
        }
      },
    );
  }

  update(value: T = null): void {
    this.futureValue = this.reducer(value, this.futureValue);
    this.futureRunQueued = true;
    this.retryCount = 0;

    this.values$.next(this.futureValue);

    switch (this.state) {
      case TaskState.RetryLimitExceeded:
        this.error = false;
      // tslint:disable-next-line:no-switch-case-fall-through
      case TaskState.Idle:
        this.state = TaskState.Delaying;
        this.pendingValue = this.futureValue;
        setTimeout(this.startRun.bind(this), !this.started ? this.initialDelay : this.delay);
        this.started = true;
        this.nextStatus();
        break;
      case TaskState.Delaying:
      case TaskState.Retrying:
        this.pendingValue = this.futureValue;
        break;
      case TaskState.Running:
        break;
      default:
        throw new Error('invalid state');
    }
  }
}
