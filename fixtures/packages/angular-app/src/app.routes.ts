import { Routes } from '@angular/router';
import { HeaderComponent } from './components/header.component';
import { UserListComponent } from './components/user-list.component';
import { ProductCardComponent } from './components/product-card.component';

// Intentional: all routes use static component: imports instead of loadComponent()
// This triggers the angular-lazy-routes check.
export const routes: Routes = [
  { path: '', component: HeaderComponent },
  { path: 'header', component: HeaderComponent },
  { path: 'users', component: UserListComponent },
  { path: 'products', component: ProductCardComponent },
];
