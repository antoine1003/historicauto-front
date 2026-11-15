import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { downloadDocumentFile } from '@app/core/utils/document-download.util';

/**
 * Bloc « Contrat d'assurance RC », monté à l'étape 1 (Entité) et à l'étape 4 (Documents).
 *
 * Une seule assurance vivante par inscription : le téléversement remplace la précédente côté back.
 * Le composant ne prend aucune entrée et lit l'état du formulaire directement, comme les composants
 * d'étape voisins.
 */
@Component({
  selector: 'app-insurance-rc',
  standalone: true,
  imports: [DatePipe, ButtonModule, FileUploadModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './insurance-rc.component.html',
})
export class InsuranceRcComponent {
  protected readonly formState = inject(EditionFormStateService);

  protected onInsuranceUpload(event: { files: File[] }): void {
    const file = event.files[0];
    if (file) {
      this.formState.uploadInsuranceDocument(file);
    }
  }

  protected download(): void {
    const doc = this.formState.insuranceDocument();
    if (!doc?.fileUrl) {
      return;
    }
    downloadDocumentFile(doc.fileUrl, doc.label);
  }
}
