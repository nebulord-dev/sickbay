import { Component, OnInit } from '@angular/core';
import { NgFor } from '@angular/common';
import { DataService } from '../services/data.service';

// Intentional: missing ChangeDetectionStrategy.OnPush (triggers angular-change-detection)
// Intentional: .subscribe() with no takeUntilDestroyed / ngOnDestroy (triggers angular-subscriptions)
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [NgFor],
  template: `
    <ul>
      <li *ngFor="let user of users">{{ user.name }}</li>
    </ul>
  `,
})
export class UserListComponent implements OnInit {
  users: Array<{ id: number; name: string }> = [];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getUsers().subscribe((users) => {
      this.users = users;
    });
  }
}
