import { Component, computed, inject, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { EditionFormStateService } from '@app/dashboard/services/edition-form-state.service';
import { DocumentItem, RegistrationStatus } from '@app/dashboard/models/edition-form.models';
import { DocumentType } from '@app/core/models/document.model';
import { InsuranceRcComponent } from '@app/dashboard/page/edition-form/components/insurance-rc/insurance-rc.component';
import { downloadDocumentFile } from '@app/core/utils/document-download.util';

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
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './step-documents.component.html',
})
export class StepDocumentsComponent implements OnInit, OnDestroy {
  protected readonly formState = inject(EditionFormStateService);

  protected readonly canSignQuote = computed(() => {
    const status = this.formState.registration()?.status;
    return status === RegistrationStatus.CONFIRMED || status === RegistrationStatus.COMPLETED;
  });

  /**
   * L'onglet s'ouvre dès l'acceptation, mais le devis n'y apparaît qu'une fois la confirmation
   * soumise : avant, il se consulte et se valide depuis l'onglet Confirmation, et un devis « en
   * attente » sans bouton de signature n'aurait rien à faire ici.
   */
  protected readonly visibleDocuments = computed(
    () =>
      this.formState
        .registration()
        ?.documents.filter(
          (doc) => doc.visible && doc.kind !== 'insurance' && (doc.kind !== 'quote' || this.canSignQuote()),
        ) ?? [],
  );

  protected readonly sharedDocuments = this.formState.sharedDocuments;

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
      downloadDocumentFile(doc.fileUrl, doc.label);
    }
  }
}
