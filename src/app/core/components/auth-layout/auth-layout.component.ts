import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="auth-shell">
      <router-outlet />
    </div>
  `,
  styleUrls: ['./auth-layout.component.scss'],
})
export class AuthLayoutComponent {
}
