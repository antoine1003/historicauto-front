import { Component, input } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [ProgressSpinnerModule],
  template: `
    <div class="auth-spinner">
      <p-progress-spinner
        [style]="{ width: size(), height: size() }"
        strokeWidth="3"
        animationDuration=".8s"
      />
      @if (message()) {
        <p class="auth-spinner__message">{{ message() }}</p>
      }
    </div>
  `,
})
export class LoaderComponent {
  message = input<string | null>(null);
  size    = input<string>('48px');
}
