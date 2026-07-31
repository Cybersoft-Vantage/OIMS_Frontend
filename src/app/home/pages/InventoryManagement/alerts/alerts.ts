import { Component } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-alerts',
  imports: [SharedModule],
  templateUrl: './alerts.html',
  styleUrl: './alerts.scss'
})
export class Alerts {
  notifications = [
    { id: 'A-001', message: 'License renewal due for Office 365', level: 'Warning', date: '2026-07-20' },
    { id: 'A-002', message: 'Printer toner is low', level: 'Info', date: '2026-07-18' },
    { id: 'A-003', message: 'Network switch firmware update required', level: 'Alert', date: '2026-07-19' }
  ];
}
