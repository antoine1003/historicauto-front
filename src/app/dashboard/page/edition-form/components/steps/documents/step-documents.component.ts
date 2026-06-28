import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { FileUploadModule } from 'primeng/fileupload';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { DocumentItem, DocumentKind } from '@app/dashboard/models/edition-form.models';

const DOCUMENT_KIND_ICON: Record<DocumentKind, string> = {
  quote: 'pi pi-file-edit',
  invoice: 'pi pi-receipt',
  insurance: 'pi pi-shield',
  supplier_list: 'pi pi-list',
  ticket: 'pi pi-ticket',
};

@Component({
  selector: 'app-step-documents',
  standalone: true,
  imports: [DatePipe, ButtonModule, TagModule, FileUploadModule],
  templateUrl: './step-documents.component.html',
})
export class StepDocumentsComponent {
  protected readonly formState = inject(EditionFormStateService);

  protected readonly visibleDocuments = computed(
    () => this.formState.registration()?.documents.filter((doc) => doc.visible) ?? [],
  );

  protected iconFor(doc: DocumentItem): string {
    return DOCUMENT_KIND_ICON[doc.kind];
  }

  protected signQuote(doc: DocumentItem): void {
    this.formState.signQuote(doc.id);
  }

  protected onInsuranceUpload(event: { files: File[] }): void {
    const file = event.files[0];
    if (file) {
      this.formState.uploadInsuranceDocument(file);
    }
  }
}
