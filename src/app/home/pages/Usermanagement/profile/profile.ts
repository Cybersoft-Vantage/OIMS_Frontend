import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import { OimsCrudService, EmployeeDetail } from 'src/app/services/oims-crud.service';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-profile',
  imports: [SharedModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfilePage implements OnInit {
  model: Partial<EmployeeDetail> = {};
  username = '';
  profileImageDataUrl: string | null = null;
  loading = false;
  passwordField?: string;

  constructor(
    private readonly auth: AuthService,
    private readonly crud: OimsCrudService,
    private readonly notify: NotificationService,
    private readonly cd: ChangeDetectorRef,
    private readonly router: Router
  ) {
    this.username = this.auth.username || '';
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  private loadProfile() {
    this.loading = true;
    this.crud.getEmployeeByUserId(this.username).subscribe({
      next: (employee) => {
        this.model = { ...employee };
        this.profileImageDataUrl = employee.ProfileImage || null;
        this.loading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.model = { UserId: this.username, FullName: this.username } as any;
        this.cd.detectChanges();
      }
    });
  }

  onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      this.profileImageDataUrl = data;
      if (this.model.EmployeeId) {
        this.crud.updateEmployee(this.model.EmployeeId, { ProfileImage: data }).subscribe({
          next: () => {
            this.notify.success('Profile image updated');
            this.auth.currentUser = {
              ...this.auth.currentUser,
              profile_image: data,
              full_name: this.model.FullName || this.auth.currentUser.full_name,
            };
            this.cd.detectChanges();
          },
          error: () => {
            this.notify.error('Unable to save profile image.');
          }
        });
      }
    };
    reader.readAsDataURL(file);
  }

  clearImage() {
    this.profileImageDataUrl = null;
    if (!this.model.EmployeeId) {
      this.notify.error('Unable to remove profile image.');
      return;
    }
    this.crud.updateEmployee(this.model.EmployeeId, { ProfileImage: null }).subscribe({
      next: () => {
        this.notify.info('Profile image removed');
        this.auth.currentUser = { ...this.auth.currentUser, profile_image: null };
        this.cd.detectChanges();
      },
      error: () => {
        this.notify.error('Unable to remove profile image.');
      }
    });
  }

  save() {
    if (!this.model.EmployeeId) {
      this.notify.error('Unable to find your employee record to update.');
      return;
    }
    const payload: Partial<EmployeeDetail> = {
      FullName: this.model.FullName,
      Email: this.model.Email,
      Phone: this.model.Phone,
      Department: this.model.Department,
      Designation: this.model.Designation,
      ProfileImage: this.profileImageDataUrl || null,
    };
    if (this.passwordField) {
      (payload as any).Password = this.passwordField;
    }
    this.crud.updateEmployee(this.model.EmployeeId!, payload).subscribe({
      next: () => {
        this.notify.success('Profile updated');
        this.auth.currentUser = {
          ...this.auth.currentUser,
          full_name: this.model.FullName || this.auth.currentUser.full_name,
          profile_image: this.profileImageDataUrl || this.auth.currentUser.profile_image,
        };
        this.loadProfile();
        try { this.router.navigate(['/analytics']); } catch {}
      },
      error: () => {
        this.notify.error('Unable to update profile');
      }
    });
  }
}
