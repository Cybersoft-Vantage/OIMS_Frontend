import { Component } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-inventory-management',
  imports: [SharedModule, RouterModule],
  templateUrl: './inventory-management.html',
  styleUrl: './inventory-management.scss'
})
export class InventoryManagement {
  activeTab = 'it-assets';
  setTab(t: string) { this.activeTab = t; }
}
