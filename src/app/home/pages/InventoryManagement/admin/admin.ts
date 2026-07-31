import { Component } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-inventory-admin',
  imports: [SharedModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class InventoryAdmin {
  sections = [
    { title: 'User Roles', description: 'Manage roles and permissions for inventory users.' },
    { title: 'Configuration', description: 'Configure inventory settings and thresholds.' },
    { title: 'Audit Logs', description: 'Review recent inventory activity and changes.' }
  ];
}
