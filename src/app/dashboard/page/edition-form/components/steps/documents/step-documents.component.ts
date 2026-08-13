import { Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { FileUploadModule } from 'primeng/fileupload';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { DocumentItem, DocumentKind, RegistrationStatus } from '@app/dashboard/models/edition-form.models';

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
export class StepDocumentsComponent implements OnInit, OnDestroy {
  protected readonly formState = inject(EditionFormStateService);

  protected readonly visibleDocuments = computed(
    () => this.formState.registration()?.documents.filter((doc) => doc.visible) ?? [],
  );

  protected readonly sharedDocuments = this.formState.sharedDocuments;

  protected readonly canSignQuote = computed(() => {
    const status = this.formState.registration()?.status;
    return status === RegistrationStatus.CONFIRMED || status === RegistrationStatus.COMPLETED;
  });

  private readonly onWindowFocus = (): void => this.formState.refreshDocuments();

  ngOnInit(): void {
    window.addEventListener('focus', this.onWindowFocus);
  }

  ngOnDestroy(): void {
    window.removeEventListener('focus', this.onWindowFocus);
  }

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

  protected downloadDocument(doc: { label: string; fileUrl: string | null }) {
    if (doc.fileUrl) {
      const a = document.createElement('a');
      let label = doc.label;
      // if it does not have extension, add .pdf
      if (!label.includes('.')) {
        label += '.pdf';
      }
      a.href = doc.fileUrl;
      a.download = label;
      a.target = '_blank';
      a.click();
    }
  }
}
