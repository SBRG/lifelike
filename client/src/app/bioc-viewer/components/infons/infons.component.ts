import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-bioc-infons',
  templateUrl: './infons.component.html',
  styleUrls: ['./infons.component.scss'],
})
export class InfonsComponent {
  @Input() data;
}
