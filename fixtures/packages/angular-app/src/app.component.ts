import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Intentional: no changeDetection: ChangeDetectionStrategy.OnPush
// This triggers the angular-change-detection check.
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {
  title = 'angular-app';
}
