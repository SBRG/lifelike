/* NOTE:
    Be very carefull with adding imports as they cannot have any DOM references
    since they are executed in a web worker enviroment.
    Faulty import will prevent the worker from compiling, returning the error of type:
     "document is undefined"
     "window is undefined"
     "alert is undefined"
*/
export enum WorkerActions {
  update,
  search,
  stop
}

export enum WorkerOutputActions {
  interrupted,
  match,
  done
}

export interface SearchWorkerMessage {
  action: WorkerActions;
  actionLoad: any;
}
