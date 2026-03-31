import { Component, OnInit } from '@angular/core';
import { NgFor, CurrencyPipe } from '@angular/common';
import { DataService } from '../services/data.service';

// Intentional: missing ChangeDetectionStrategy.OnPush (triggers angular-change-detection)
// Intentional: .subscribe() with no cleanup (triggers angular-subscriptions)
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [NgFor, CurrencyPipe],
  template: `
    <div *ngFor="let product of products">
      <h3>{{ product.name }}</h3>
      <p>{{ product.price | currency }}</p>
    </div>
  `,
})
export class ProductCardComponent implements OnInit {
  products: Array<{ id: number; name: string; price: number }> = [];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getProducts().subscribe((products) => {
      this.products = products;
    });
  }
}
