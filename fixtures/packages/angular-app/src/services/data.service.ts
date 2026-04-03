import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(private sanitizer: DomSanitizer) {}

  // Intentional: bypassSecurityTrustHtml (triggers angular-security check)
  getTrustedHtml(raw: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  }

  getUsers(): Observable<Array<{ id: number; name: string }>> {
    return of([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  }

  getProducts(): Observable<Array<{ id: number; name: string; price: number }>> {
    return of([
      { id: 1, name: 'Widget', price: 9.99 },
      { id: 2, name: 'Gadget', price: 24.99 },
    ]);
  }
}
