import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    <div class="modal-backdrop" (click)="onBackdrop($event)">
      <div class="modal">
        <h2>{{ title }}</h2>
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent {
  @Input() title = '';
  @Output() closed = new EventEmitter<void>();

  onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) this.closed.emit();
  }
}
