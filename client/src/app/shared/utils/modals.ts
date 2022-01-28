import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgbModalOptions } from '@ng-bootstrap/ng-bootstrap/modal/modal-config';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref';

/**
 * Opens a modal in a more type-safe manner because the return value is better typed.
 *
 * @param modalService the modal service
 * @param component the component
 * @param options dialog options
 */
export function openModal<T>(modalService: NgbModal,
                             component: new (...args: any[]) => T,
                             options?: NgbModalOptions):
  Omit<NgbModalRef, 'componentInstance'> & { componentInstance: T } {
  return modalService.open(component, options);
}
