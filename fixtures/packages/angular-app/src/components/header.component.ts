import { Component } from '@angular/core';

// Intentional: missing ChangeDetectionStrategy.OnPush
@Component({
  selector: 'app-header',
  standalone: true,
  template: `<header><h1>Angular App</h1></header>`,
})
export class HeaderComponent {
  links = ['Home', 'Users', 'Products'];
}
