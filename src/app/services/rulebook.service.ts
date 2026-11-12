import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * CitCom rulebook, through the marketplace proxy: the classes an offer can use and
 * the policies and terms of a new offer. The proxy fixes the provider (the
 * organisation the user acts for) and checks every write against the rulebook.
 */
@Injectable({ providedIn: 'root' })
export class RulebookService {
  constructor(private http: HttpClient) {}

  classes(): Promise<any[]> {
    return lastValueFrom(this.http.get<any[]>(`${environment.BASE_URL}/rulebook/classes`));
  }

  generate(body: { class: string; offer: any; provider_terms: any }): Promise<any> {
    return lastValueFrom(this.http.post<any>(`${environment.BASE_URL}/rulebook/generate`, body));
  }
}
