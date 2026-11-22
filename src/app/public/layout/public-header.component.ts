import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { DEFAULT_LOGO_URL } from '@app/public/models/home-content.model';
import { HomeContentService } from '@app/public/services/home-content.service';

@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-header.component.html',
  styles: [':host { display: contents; }'],
})
export class PublicHeaderComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Même image que le haut de la page d'accueil, administrée dans « Page d'accueil ». */
  protected readonly logoUrl = toSignal(inject(HomeContentService).logoUrl(), { initialValue: DEFAULT_LOGO_URL });

  /** Menu déroulant affiché sous `md` uniquement. */
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.closeMenu();
    this.auth.logout();
    void this.router.navigate(['/']);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeMenu();
  }
}
