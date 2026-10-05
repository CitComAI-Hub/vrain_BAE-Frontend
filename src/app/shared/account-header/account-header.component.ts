import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { LoginInfo } from 'src/app/models/interfaces';
import { EventMessageService } from 'src/app/services/event-message.service';
import { LocalStorageService } from 'src/app/services/local-storage.service';

/**
 * Page header shared by the signed-in area (profile, offerings, orders...).
 * Presentation only: shows breadcrumb, title, subtitle and the session the user is acting as.
 */
@Component({
  selector: 'app-account-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './account-header.component.html'
})
export class AccountHeaderComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() subtitle = '';

  sessionName = '';
  sessionInitials = '';
  actingAsOrg = false;

  private destroy$ = new Subject<void>();

  constructor(
    private localStorage: LocalStorageService,
    private eventMessage: EventMessageService
  ) { }

  ngOnInit(): void {
    this.readSession();
    this.eventMessage.messages$.pipe(takeUntil(this.destroy$)).subscribe((ev) => {
      if (ev.type === 'ChangedSession' || ev.type === 'LoginProcess') {
        this.readSession();
      }
    });
  }

  private readSession(): void {
    const info = this.localStorage.getObject('login_items') as LoginInfo;
    if (!info || JSON.stringify(info) === '{}') {
      this.sessionName = '';
      return;
    }

    this.actingAsOrg = !!info.logged_as && info.logged_as !== info.id;
    if (this.actingAsOrg) {
      const org = (info.organizations ?? []).find((o: any) => o.id === info.logged_as);
      this.sessionName = org?.name ?? '';
    } else {
      this.sessionName = info.user ?? '';
    }
    this.sessionInitials = this.sessionName.slice(0, 2).toUpperCase();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
