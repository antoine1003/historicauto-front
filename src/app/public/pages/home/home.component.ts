import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';

/**
 * Page de présentation publique. Purement présentationnelle : sa seule dépendance est
 * `AuthService`, utilisé pour adapter l'intitulé et la cible des appels à l'action.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly auth = inject(AuthService);
}
