/// <reference lib="webworker" />

/* NOTE:
    Be very carefull with those imports as they cannot have any DOM references
    since they are executed in a web worker enviroment.
    Faulty import will prevent the worker from compiling, returning the error of type:
     "document is undefined"
     "window is undefined"
     "alert is undefined"
*/
import { defer } from 'lodash-es';

import { uuidv4 } from 'app/shared/utils/identifiers';

import { SearchWorkerMessage, WorkerActions, WorkerOutputActions } from './search-worker-actions';
import { SankeySearch, SearchEntity } from './search-match';

const search = new SankeySearch();
let searchId;

addEventListener('message', async ({data: messageData}) => {
  const {
    action,
    actionLoad
  } = (messageData as SearchWorkerMessage);
  if (action === WorkerActions.update) {
    search.update(actionLoad);
  } else if (action === WorkerActions.search) {
    const thisSearchId = uuidv4();
    searchId = thisSearchId;
    const generator = search.traverseAll();

    function step() {
      const match = generator.next();
      if (!match.done) {
        const {matchGenerator, ...rest} = match.value;
        if (thisSearchId === searchId) {
          postMessage({
            action: WorkerOutputActions.match,
            actionLoad: rest as SearchEntity
          });
          defer(step);
        } else {
          postMessage({
            action: WorkerOutputActions.interrupted
          });
        }
      } else {
        postMessage({
          action: WorkerOutputActions.done
        });
      }
    }

    step();
  } else if (action === WorkerActions.stop) {
    searchId = undefined;
  }
});



