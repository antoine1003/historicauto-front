import { Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { DocumentItem, RegistrationStatus } from '@app/dashboard/models/edition-form.models';
import { DocumentType } from '@app/core/models/document.model';
import { InsuranceRcComponent } from '@app/dashboard/page/edition-form/components/insurance-rc/insurance-rc.component';

const DOCUMENT_TYPE_ICON: Record<DocumentType, string> = {
  quote: 'pi pi-file-edit',
  invoice: 'pi pi-receipt',
  insurance: 'pi pi-shield',
  ticket: 'pi pi-ticket',
  other: 'pi pi-file',
};

@Component({
  selector: 'app-step-documents',
  standalone: true,
  imports: [DatePipe, ButtonModule, TagModule, InsuranceRcComponent],
  templateUrl: './step-documents.component.html',
})
export class StepDocumentsComponent implements OnInit, OnDestroy {
  protected readonly formState = inject(EditionFormStateService);

  protected readonly visibleDocuments = computed(
    () =>
      this.formState
        .registration()
        ?.documents.filter((doc) => doc.visible && doc.kind !== 'insurance') ?? [],
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
    return DOCUMENT_TYPE_ICON[doc.kind];
  }

  protected signQuote(doc: DocumentItem): void {
    this.formState.signQuote(doc.id);
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
