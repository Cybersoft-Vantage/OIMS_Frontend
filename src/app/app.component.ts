// Angular Import
import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { SessionTimeoutService } from './services/session-timeout.service';
import { AuthService } from './services/auth.service';

// project import
import { SpinnerComponent } from './theme/shared/components/spinner/spinner.component';

@Component({
  selector: 'app-root',
  imports: [RouterModule, SpinnerComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private sessionTimeout = inject(SessionTimeoutService);
  private auth = inject(AuthService);

  // life cycle event
  ngOnInit() {
    this.sessionTimeout.start();
    if (this.auth.token) {
      this.auth.loadCurrentUser().subscribe({
        error: () => {
          this.auth.logout();
        }
      });
    }
    this.router.events.subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      window.scrollTo(0, 0);
    });
  }
}
