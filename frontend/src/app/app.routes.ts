import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { ShellComponent } from './shared/shell.component';
import { AccountDetailComponent } from './pages/account-detail.component';
import { AccountsComponent } from './pages/accounts.component';
import { ActivitiesComponent } from './pages/activities.component';
import { ContactsComponent } from './pages/contacts.component';
import { DashboardComponent } from './pages/dashboard.component';
import { LoginComponent } from './pages/login.component';
import { OpportunityDetailComponent } from './pages/opportunity-detail.component';
import { PipelineComponent } from './pages/pipeline.component';
import { ProjectDetailComponent } from './pages/project-detail.component';
import { ProjectsComponent } from './pages/projects.component';
import { ReportsComponent } from './pages/reports.component';
import { SalesComponent } from './pages/sales.component';
import { SettingsComponent } from './pages/settings.component';
import { SignupComponent } from './pages/signup.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'pipeline', component: PipelineComponent },
      { path: 'accounts', component: AccountsComponent },
      { path: 'accounts/:id', component: AccountDetailComponent },
      { path: 'contacts', component: ContactsComponent },
      { path: 'opportunities/:id', component: OpportunityDetailComponent },
      { path: 'sales', component: SalesComponent },
      { path: 'projects', component: ProjectsComponent },
      { path: 'projects/:id', component: ProjectDetailComponent },
      { path: 'activities', component: ActivitiesComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
