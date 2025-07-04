import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BatchSummaryComponent } from './batch-summary/batch-summary.component';

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: BatchSummaryComponent },
  { path: '**', redirectTo: '/dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
