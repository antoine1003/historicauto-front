import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { AuthService } from '@app/core/services/auth.service';
import { ContactRequest, ContactSubject } from '@app/public/models/contact.model';
import { ContactService } from '@app/public/services/contact.service';
import { CaptchaFieldComponent } from '@app/shared/components/captcha/captcha-field.component';
import { environment } from '../../../../environments/environment';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SubjectOption {
  readonly label: string;
  readonly value: ContactSubject;
}

/**
 * Formulaire de contact public.
 *
 * Un exposant connecté n'a pas à ressaisir son identité : les champs nom et adresse email
 * sont remplacés par un rappel, et les valeurs de son profil alimentent la charge utile.
 */
@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule, CaptchaFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact.component.html',
})
export class ContactComponent {
  private readonly contactService = inject(ContactService);
  protected readonly auth = inject(AuthService);

  protected readonly contactEmail = environment.contactEmail;

  protected readonly subjectOptions: SubjectOption[] = [
    { label: 'Réserver un stand', value: 'stand' },
    { label: 'Question sur ma demande', value: 'demande' },
    { label: 'Facturation', value: 'facturation' },
    { label: 'Autre', value: 'autre' },
  ];

  // ── Saisie ──
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly subject = signal<ContactSubject | null>(null);
  protected readonly message = signal('');

  protected readonly nameTouched = signal(false);
  protected readonly emailTouched = signal(false);
  protected readonly subjectTouched = signal(false);
  protected readonly messageTouched = signal(false);

  // ── États ──
  protected readonly loading = signal(false);
  protected readonly sent = signal(false);
  protected readonly apiError = signal<string | null>(null);

  // ── Gestion du focus autour de l'état de succès ──
  private readonly successTitle = viewChild<ElementRef<HTMLElement>>('successTitle');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly errorBanner = viewChild<ElementRef<HTMLElement>>('errorBanner');
  private readonly captcha = viewChild(CaptchaFieldComponent);
  private wasSent = false;

  constructor() {
    afterRenderEffect(() => {
      const isSent = this.sent();
      if (isSent && !this.wasSent) {
        this.successTitle()?.nativeElement.focus();
      } else if (!isSent && this.wasSent) {
        this.panel()?.nativeElement.focus();
      }
      this.wasSent = isSent;
    });
  }

  /** Vrai une fois l'authentification résolue ; le bloc identité reste masqué avant. */
  protected readonly authResolved = this.auth.isInitialized;

  /** Profil de l'exposant connecté, ou `null` si le visiteur n'est pas connecté. */
  protected readonly knownUser = this.auth.currentUser;

  /** Adresse à laquelle la réponse sera envoyée, rappelée dans l'état de succès. */
  protected readonly replyToEmail = computed(
    () => this.knownUser()?.email ?? this.email().trim()
  );

  protected readonly nameError = computed<string | null>(() => {
    if (this.knownUser() !== null || !this.nameTouched()) {
      return null;
    }
    const value = this.name().trim();
    if (value.length === 0) {
      return 'Merci d’indiquer votre nom.';
    }
    if (value.length < 2) {
      return 'Le nom doit contenir au moins 2 caractères.';
    }
    return null;
  });

  protected readonly emailError = computed<string | null>(() => {
    if (this.knownUser() !== null || !this.emailTouched()) {
      return null;
    }
    const value = this.email().trim();
    if (value.length === 0) {
      return 'Merci d’indiquer votre adresse email.';
    }
    if (!EMAIL_PATTERN.test(value)) {
      return 'Cette adresse email n’est pas valide.';
    }
    return null;
  });

  protected readonly subjectError = computed<string | null>(() =>
    this.subjectTouched() && this.subject() === null ? 'Merci de choisir un sujet.' : null
  );

  protected readonly messageError = computed<string | null>(() => {
    if (!this.messageTouched()) {
      return null;
    }
    const value = this.message().trim();
    if (value.length === 0) {
      return 'Merci d’écrire votre message.';
    }
    if (value.length < 10) {
      return 'Le message doit contenir au moins 10 caractères.';
    }
    return null;
  });

  /** Validité réelle, indépendante du fait que les champs aient été touchés ou non. */
  private readonly formValid = computed(() => {
    const identityValid =
      this.knownUser() !== null ||
      (this.name().trim().length >= 2 && EMAIL_PATTERN.test(this.email().trim()));
    return (
      identityValid &&
      this.subject() !== null &&
      this.message().trim().length >= 10 &&
      this.captcha()?.payload() != null
    );
  });

  protected onSubmit(): void {
    this.nameTouched.set(true);
    this.emailTouched.set(true);
    this.subjectTouched.set(true);
    this.messageTouched.set(true);
    this.captcha()?.markTouched();

    const subject = this.subject();
    const captchaPayload = this.captcha()?.payload() ?? null;
    if (this.loading() || !this.formValid() || subject === null || captchaPayload === null) {
      return;
    }

    this.apiError.set(null);

    const user = this.knownUser();
    const payload: ContactRequest = {
      // Le back ne fournit pas encore de nom pour l'exposant connecté : on retombe sur son email, faute de mieux.
      name: user?.email ?? this.name().trim(),
      email: user?.email ?? this.email().trim(),
      subject,
      message: this.message().trim(),
      ...captchaPayload,
    };

    this.loading.set(true);
    this.contactService.send(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        // Le défi est brûlé côté serveur dès la première vérification, juste ou fausse : la question
        // affichée est morte quoi qu'il arrive.
        this.captcha()?.refresh();
        const body = err?.error;
        if (body?.errors?.[0]) {
          this.apiError.set(body.errors[0]);
        } else if (body?.message) {
          this.apiError.set(body.message);
        } else {
          this.apiError.set('Votre message n’a pas pu être envoyé. Merci de réessayer dans un instant.');
        }
        // La bannière n'existe dans le DOM qu'une fois l'erreur posée : on laisse un cycle de rendu
        // s'écouler avant de la chercher, puis on l'amène dans le champ de vision.
        setTimeout(() => {
          this.errorBanner()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 0);
      },
    });
  }

  protected reset(): void {
    this.name.set('');
    this.email.set('');
    this.subject.set(null);
    this.message.set('');
    this.nameTouched.set(false);
    this.emailTouched.set(false);
    this.subjectTouched.set(false);
    this.messageTouched.set(false);
    this.apiError.set(null);
    this.sent.set(false);
  }
}
