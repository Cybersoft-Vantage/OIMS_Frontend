import { ChangeDetectorRef, Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ApexOptions, ChartComponent, NgApexchartsModule } from 'ng-apexcharts';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OimsCrudService } from 'src/app/services/oims-crud.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-dash-analytics',
  imports: [SharedModule, NgApexchartsModule, RouterModule],
  templateUrl: './dash-analytics.component.html',
  styleUrls: ['./dash-analytics.component.scss']
})
export class DashAnalyticsComponent implements OnInit {
  @ViewChild('inventoryTrendChart') inventoryTrendChart?: ChartComponent;
  @ViewChild('assetHealthChart') assetHealthChart?: ChartComponent;

  data: any;
  chartOptions: Partial<ApexOptions> = {
    chart: { height: 260, type: 'line', toolbar: { show: false } },
    dataLabels: { enabled: false },
    stroke: { width: 3, curve: 'smooth' },
    series: [{ name: 'Assets Added', data: [] }],
    legend: { position: 'top' },
    xaxis: { categories: [], axisBorder: { show: false } },
    yaxis: { min: 0 },
    colors: ['#2563eb'],
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        gradientToColors: ['#60a5fa'],
        shadeIntensity: 0.3,
        type: 'horizontal',
        opacityFrom: 0.9,
        opacityTo: 0.8,
        stops: [0, 100]
      }
    },
    grid: { borderColor: '#e5e7eb' }
  };

  statusChartOptions: Partial<ApexOptions> = {
    chart: { type: 'donut', height: 220 },
    dataLabels: { enabled: false },
    labels: ['Operational', 'Maintenance', 'Needs Review'],
    series: [0, 0, 0],
    legend: { position: 'bottom' },
    colors: ['#2563eb', '#f59e0b', '#ef4444'],
    plotOptions: { pie: { donut: { size: '72%' } } },
    tooltip: { theme: 'light' }
  };

  summaryCards: Array<{ title: string; value: string; trend: string; icon: string; accent: string }> = [];
  renewals: Array<{ name: string; owner: string; due: string; severity: string }> = [];
  activityFeed: Array<{ title: string; detail: string; time: string }> = [];
  lowStockAlerts: Array<{ name: string; quantity: number; detail: string }> = [];
  criticalItems: Array<{ title: string; detail: string; severity: string }> = [];
  heatmap: Array<{ department: string; count: number }> = [];
  lastUpdated = '';
  isLoading = true;
  showCharts = true;

  constructor(private readonly crud: OimsCrudService, private readonly cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {

    this.isLoading = true;

    forkJoin({
      // assets: this.crud.getAssets().pipe(catchError(() => of([]))),
      detailedAssets: this.crud.getDetailedAssets().pipe(catchError(() => of([]))),
      // assignments: this.crud.getAssetAssignments(),
      assignments: this.crud.getDetailedAssignments().pipe(catchError(() => of([]))),
      employees: this.crud.getEmployees().pipe(catchError(() => of([]))),
      components: this.crud.getDetailedAssets().pipe(catchError(() => of([]))),
      procurements: this.crud.getProcurements().pipe(catchError(() => of([]))),
      licenses: this.crud.getLicenses().pipe(catchError(() => of([])))
    }).subscribe({

      next: (data) => {
        // const assets = data.assets || [];
        const detailedAssets = data.detailedAssets || [];
        const assignments = data.assignments || [];
        const employees = data.employees || [];
        const components = data.components || [];
        const procurements = data.procurements || [];
        const licenses = data.licenses || [];
        
        const assignedAssets = assignments.filter((assignment: any) => assignment.IsReturned == false);
        const availableAssets = detailedAssets.length - assignedAssets.length;
        const maintenanceAssets = detailedAssets.filter((detailedAssets: any) => /maintenance|damaged|repair|warning/i.test(String(detailedAssets.Status || '')));
        const reviewAssets = detailedAssets.filter((detailedAssets: any) => /review|needs|pending/i.test(String(detailedAssets.Status || '')));

        const operationalAssets = detailedAssets.filter((detailedAssets: any) => !maintenanceAssets.includes(detailedAssets) && !reviewAssets.includes(detailedAssets));
        const inventoryAssets = [...detailedAssets];
 
        this.summaryCards = [
          { title: 'Total Assets', value: String(detailedAssets.length), trend: `${availableAssets} available now`, icon: 'icon-box', accent: 'bg-primary' },
          { title: 'Assigned', value: String(assignedAssets.length), trend: `${assignments.length} assignment records`, icon: 'icon-user', accent: 'bg-success' },
          { title: 'Maintenance', value: String(maintenanceAssets.length), trend: `${reviewAssets.length} need review`, icon: 'icon-tool', accent: 'bg-warning' },
          { title: 'Procurement', value: String(procurements.length), trend: `${procurements.filter((item: any) => String(item.Status || '').toLowerCase() === 'pending').length} pending`, icon: 'icon-shopping-cart', accent: 'bg-danger' }
        ];



        this.chartOptions = {
          ...this.chartOptions,
          xaxis: { categories: this.buildMonthLabels(), axisBorder: { show: true } },
          series: [{ name: 'Assets Added', data: this.buildMonthSeries(inventoryAssets) }],
        };

        this.statusChartOptions = {
          ...this.statusChartOptions,
          series: [Math.max(1, operationalAssets.length), Math.max(1, maintenanceAssets.length), Math.max(1, reviewAssets.length)]
        };

        this.lowStockAlerts = components
          .filter((component: any) => Number(component.Quantity || 0) <= 3)
          .slice(0, 5)
          .map((component: any) => ({
            name: component.Name || 'Unnamed component',
            quantity: Number(component.Quantity || 0),
            detail: `Component stock is below the safe threshold`
          }));

        this.renewals = licenses
          .filter((license: any) => license.RenewalDate)
          .sort((a: any, b: any) => String(a.RenewalDate).localeCompare(String(b.RenewalDate)))
          .slice(0, 3)
          .map((license: any) => ({
            name: license.SoftwareName,
            owner: license.Vendor || 'IT Operations',
            due: `Due ${license.RenewalDate}`,
            severity: this.getRenewalSeverity(license.RenewalDate)
          }));

        this.heatmap = this.buildAssignmentHeatmap(assignments, employees);

        this.criticalItems = [
          ...maintenanceAssets.slice(0, 2).map((asset: any) => ({
            title: asset.Name || 'Unnamed asset',
            detail: `Status: ${asset.Status || 'Unknown'}`,
            severity: 'high'
          })),
          ...this.lowStockAlerts.slice(0, 2).map((item: any) => ({
            title: item.name,
            detail: `${item.quantity} units remaining`,
            severity: 'medium'
          })),
          ...licenses.filter((license: any) => this.isExpiringSoon(license.RenewalDate)).slice(0, 2).map((license: any) => ({
            title: license.SoftwareName,
            detail: `Renewal: ${license.RenewalDate || 'Not set'}`,
            severity: 'medium'
          }))
        ].slice(0, 6);

        this.activityFeed = [
          { title: 'Asset inventory refreshed', detail: `${detailedAssets.length} assets loaded from the backend.`, time: 'Just now' },
          { title: 'Assignments synced', detail: `${assignments.length} assignment events available.`, time: 'Updated live' },
          { title: 'Low-stock review generated', detail: `${this.lowStockAlerts.length} components need attention.`, time: 'Based on current records' }
        ];

        this.lastUpdated = new Date().toLocaleString();
        this.isLoading = false;
        this.cdr.detectChanges();
        this.remountCharts();
      },
      error: () => {
        this.summaryCards = [];
        this.renewals = [];
        this.activityFeed = [];
        this.lowStockAlerts = [];
        this.criticalItems = [];
        this.heatmap = [];
        this.lastUpdated = 'Unable to load data';
        this.isLoading = false;
        this.cdr.detectChanges();
        this.remountCharts();
      }

    });



  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.reflowCharts();
  }

  private reflowCharts(): void {
    setTimeout(() => {
      this.inventoryTrendChart?.updateOptions({}, false, true, true);
      this.assetHealthChart?.updateOptions({}, false, true, true);
      window.dispatchEvent(new Event('resize'));
    }, 0);
  }

  private remountCharts(): void {
    this.showCharts = false;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showCharts = true;
      this.cdr.detectChanges();
      this.reflowCharts();
    }, 0);
  }

  private buildMonthSeries(records: Array<any>): number[] {
    const labels = this.buildMonthLabels();
    const now = new Date();
    const keys: string[] = labels.map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (labels.length - 1 - idx), 1);
      return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    });

    const counts = Array(keys.length).fill(0);

    records.forEach((record: any) => {
      const created = record.CreatedAt || record.createdAt || record.PurchaseDate || record.PurchaseDateTime || record.DateAdded || record.date || null;
      if (!created) return;
      const date = new Date(String(created));
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      const idx = keys.indexOf(key);
      if (idx >= 0) counts[idx] += 1;
    });

    return counts;
  }

  private buildMonthLabels(): string[] {
    const labels: string[] = [];
    const now = new Date();
    // produce last 6 months, oldest -> newest
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString(undefined, { month: 'short' }));
    }
    return labels;
  }

  private getRenewalSeverity(renewalDate: string | null | undefined): string {
    if (!renewalDate) return 'info';
    const today = new Date();
    const due = new Date(renewalDate);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) return 'warning';
    if (diffDays <= 30) return 'info';
    return 'success';
  }

  private isExpiringSoon(renewalDate: string | null | undefined): boolean {
    if (!renewalDate) return false;
    const today = new Date();
    const due = new Date(renewalDate);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  }

  private buildAssignmentHeatmap(assignments: Array<any>, employees: Array<any>): Array<{ department: string; count: number }> {
    const counts = new Map<string, number>();
    assignments.forEach((assignment: any) => {
      const employee = employees.find((item: any) => item.EmployeeId === assignment.EmployeeId);
      const department = employee?.Department || 'Unassigned';
      counts.set(department, (counts.get(department) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([department, count]) => ({ department, count })).slice(0, 6);
  }
}
