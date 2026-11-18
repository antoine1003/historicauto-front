import { Directive, ElementRef, forwardRef, HostListener, inject, Pipe, PipeTransform, Renderer2 } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALUE_ACCESSOR, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
  AsYouType,
  CountryCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from 'libphonenumber-js';

/**
 * Mise en forme des numéros de téléphone saisis par l'exposant (libphonenumber-js).
 *
 * France par défaut : « 0612345678 » devient « 06 12 34 56 78 ». Un numéro étranger doit commencer
 * par son indicatif (« +32… » ou « 0032… ») : il est alors mis en forme selon son pays et gardé au
 * format international (« +32 470 12 34 56 »). Un numéro français saisi en +33 est ramené au format
 * national. La valeur enregistrée est la valeur affichée, le back la stocke telle quelle.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'FR';

/** Format d'enregistrement d'un numéro complet et valide ; la saisie brute sinon. */
export function normalizePhone(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (raw === '') {
    return '';
  }
  const phone = parsePhoneNumberFromString(raw, DEFAULT_PHONE_COUNTRY);
  if (!phone || !phone.isValid()) {
    return new AsYouType(DEFAULT_PHONE_COUNTRY).input(raw);
  }
  return phone.country === DEFAULT_PHONE_COUNTRY ? phone.formatNational() : phone.formatInternational();
}

/** Champ facultatif : vide accepté, sinon le numéro doit être valide (erreur `phone`). */
export const phoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = ((control.value as string | null) ?? '').trim();
  return value === '' || isValidPhoneNumber(value, DEFAULT_PHONE_COUNTRY) ? null : { phone: true };
};

/** Même règle que `phoneValidator`, pour les champs hors formulaire réactif. */
export function isValidOrEmptyPhone(value: string | null | undefined): boolean {
  const raw = (value ?? '').trim();
  return raw === '' || isValidPhoneNumber(raw, DEFAULT_PHONE_COUNTRY);
}

/** Caractères qui comptent pour le placement du curseur (les espaces sont ajoutés par le formatage). */
const isSignificant = (char: string): boolean => /[\d+]/.test(char);
const countSignificant = (text: string): number => [...text].filter(isSignificant).length;

/**
 * Longueur maximale atteinte : selon le plan de numérotation du pays quand on le connaît
 * (10 chiffres pour un numéro français saisi en 0X, 9 après +33, 9 après +34…), et dans tous les
 * cas 15 chiffres indicatif compris, plafond de la norme internationale E.164 — plus 2 pour le
 * préfixe « 00 » qui remplace le « + ».
 */
function isTooLong(text: string): boolean {
  const digits = text.replace(/\D/g, '');
  const max = text.trim().startsWith('00') ? 17 : 15;
  return digits.length > max || validatePhoneNumberLength(text, DEFAULT_PHONE_COUNTRY) === 'TOO_LONG';
}

/**
 * `<input appPhoneFormat formControlName="phone">` ou `[(ngModel)]` : met en forme au fil de la
 * saisie, en gardant le curseur au même chiffre, puis normalise à la sortie du champ.
 * Remplace le DefaultValueAccessor d'Angular sur ce champ.
 */
@Directive({
  selector: 'input[appPhoneFormat]',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneFormatDirective), multi: true }],
  host: { type: 'tel', autocomplete: 'tel', inputmode: 'tel' },
})
export class PhoneFormatDirective implements ControlValueAccessor {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private previousValue = '';

  writeValue(value: string | null): void {
    this.setView(normalizePhone(value));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.renderer.setProperty(this.el.nativeElement, 'disabled', isDisabled);
  }

  @HostListener('input', ['$event'])
  protected onInput(event: InputEvent): void {
    const input = this.el.nativeElement;
    let raw = input.value;
    let caret = input.selectionStart ?? raw.length;

    // Retour arrière sur un espace ajouté par le formatage : sans ce cas, l'espace réapparaîtrait
    // aussitôt et le curseur resterait bloqué. On efface le chiffre qui le précède.
    if (event.inputType === 'deleteContentBackward' && countSignificant(raw) === countSignificant(this.previousValue)) {
      const before = raw.slice(0, caret);
      const index = [...before].map((c, i) => (isSignificant(c) ? i : -1)).filter((i) => i >= 0).pop();
      if (index !== undefined) {
        raw = raw.slice(0, index) + raw.slice(index + 1);
        caret = index;
      }
    }

    // Numéro complet : un chiffre tapé en plus est refusé, le champ reste tel quel. Un collage trop
    // long est tronqué à la longueur maximale.
    if (isTooLong(raw)) {
      if (event.inputType === 'insertText' && !isTooLong(this.previousValue)) {
        const back = Math.max(0, caret - (raw.length - this.previousValue.length));
        this.setView(this.previousValue);
        input.setSelectionRange(back, back);
        return;
      }
      while (isTooLong(raw)) {
        const last = [...raw].map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0).pop();
        if (last === undefined) {
          break;
        }
        raw = raw.slice(0, last) + raw.slice(last + 1);
      }
      caret = Math.min(caret, raw.length);
    }

    const significantBeforeCaret = countSignificant(raw.slice(0, caret));
    const formatted = new AsYouType(DEFAULT_PHONE_COUNTRY).input(raw);
    this.setView(formatted);

    let position = 0;
    for (let seen = 0; position < formatted.length && seen < significantBeforeCaret; position++) {
      if (isSignificant(formatted[position])) {
        seen++;
      }
    }
    input.setSelectionRange(position, position);

    this.onChange(formatted);
  }

  @HostListener('blur')
  protected onBlur(): void {
    const normalized = normalizePhone(this.el.nativeElement.value);
    if (normalized !== this.el.nativeElement.value) {
      this.setView(normalized);
      this.onChange(normalized);
    }
    this.onTouched();
  }

  private setView(value: string): void {
    this.previousValue = value;
    this.renderer.setProperty(this.el.nativeElement, 'value', value);
  }
}

/** Affichage d'un numéro déjà enregistré, y compris ceux saisis avant la mise en forme. */
@Pipe({ name: 'phone', standalone: true })
export class PhonePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return normalizePhone(value);
  }
}
