import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { FileUploadModule } from 'primeng/fileupload';
import { ClubType, ExhibitorType, StandManagerForm } from '@app/dashboard/models/edition-form.models';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';

interface ClubTypeOption {
  label: string;
  value: ClubType;
}

@Component({
  selector: 'app-step-entity',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule, FileUploadModule],
  templateUrl: './step-entity.component.html',
})
export class StepEntityComponent {
  protected readonly formState = inject(EditionFormStateService);

  protected readonly ExhibitorType = ExhibitorType;

  protected readonly clubTypeOptions: ClubTypeOption[] = [
    { label: 'Marque / Modèle', value: ClubType.BRAND_MODEL },
    { label: 'Généraliste', value: ClubType.GENERALIST },
  ];

  protected newManager: Omit<StandManagerForm, 'id'> = {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  };

  protected addManager(): void {
    if (!this.newManager.firstName || !this.newManager.lastName || !this.newManager.email) {
      return;
    }

    this.formState.addManager({ id: crypto.randomUUID(), ...this.newManager });
    this.newManager = { firstName: '', lastName: '', phone: '', email: '' };
  }

  protected removeManager(managerId: string): void {
    this.formState.removeManager(managerId);
  }

  /**
   * MOCK — le visuel n'est pas réellement téléversé ici. Brancher sur
   * POST /api/registrations/{id}/exhibitor-visual (multipart) puis stocker l'URL retournée,
   * pas le File lui-même, dans EntityStepState.visualFileName.
   */
  protected onVisualSelected(event: { files: File[] }): void {
    const file = event.files[0];
    if (file) {
      this.formState.updateEntity({ visualFileName: file.name });
    }
  }
}
