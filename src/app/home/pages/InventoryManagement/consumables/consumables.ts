import { Component } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-consumables',
  imports: [SharedModule],
  templateUrl: './consumables.html',
  styleUrl: './consumables.scss'
})
export class Consumables {
  items = [
    { id: 'C-001', name: 'Ink Cartridge', stock: 38, threshold: 20 },
    { id: 'C-002', name: 'AA Batteries', stock: 120, threshold: 50 },
    { id: 'C-003', name: 'Paper Reams', stock: 14, threshold: 10 }
  ];
}
