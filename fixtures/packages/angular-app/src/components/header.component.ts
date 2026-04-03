import { Component } from '@angular/core';

// Intentional: change detection strategy not set (triggers angular-change-detection check)
// Intentional: [innerHTML] binding (triggers angular-security check)
// Intentional: function call in template interpolation (triggers angular-template-performance check)
@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header>
      <h1>Angular App</h1>
      <div [innerHTML]="subtitle"></div>
      <span>{{ getYear() }}</span>
    </header>
  `,
})
export class HeaderComponent {
  links = ['Home', 'Users', 'Products'];
  subtitle = '<em>Health check fixture</em>';

  getYear(): number {
    return new Date().getFullYear();
  }
}
