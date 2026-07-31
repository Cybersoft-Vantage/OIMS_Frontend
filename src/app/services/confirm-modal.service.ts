import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmModalComponent } from 'src/app/shared/confirm-modal/confirm-modal.component';

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  constructor(private modal: NgbModal) {}

  confirm(message: string, title = 'Confirm'): Promise<boolean> {
    const ref = this.modal.open(ConfirmModalComponent, { centered: true });
    ref.componentInstance.message = message;
    ref.componentInstance.title = title;
    return ref.result.then((r) => !!r).catch(() => false);
  }
}
