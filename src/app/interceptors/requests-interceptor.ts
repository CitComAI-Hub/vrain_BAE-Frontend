import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import {LocalStorageService} from "../services/local-storage.service";
import {EventMessageService} from "../services/event-message.service";
import { LoginInfo } from '../models/interfaces';
import * as moment from 'moment';
import { environment } from 'src/environments/environment';

@Injectable()
export class RequestInterceptor implements HttpInterceptor {

    public static BASE_URL: String = environment.BASE_URL;
    public static API_ORDERING: String = environment.PRODUCT_ORDER;
    public static ORDER_LIMIT: Number = environment.ORDER_LIMIT;
    // Message sent by the proxy (lib/auth.js, headerAuthentication) when it cannot resolve the token
    private static UNKNOWN_TOKEN_ERROR = 'It has not been possible to obtain your user info';

    constructor(private localStorage: LocalStorageService, private eventMessage: EventMessageService) { }
  
    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        let aux = this.localStorage.getObject('login_items') as LoginInfo;
        if(JSON.stringify(aux) != '{}' && (((aux.expire - moment().unix())-4) > 0)) {
            if(aux.logged_as != aux.id){
                let modifiedRequest = request.clone({
                    setHeaders: {
                    'Authorization': 'Bearer '+aux.token,
                    'X-Organization': aux.logged_as
                    },
                });
                if (request.url.startsWith(`${RequestInterceptor.BASE_URL}${RequestInterceptor.API_ORDERING}/productOrder`)) {
                    modifiedRequest = request.clone({
                        setHeaders: {
                        'Authorization': 'Bearer '+aux.token,
                        'X-Organization': aux.logged_as,
                        'X-Terms-Accepted': 'true'
                        },
                    });
                }  
                return this.handleStaleSession(request, modifiedRequest, next, aux.token);
            } else {
                let modifiedRequest = request.clone({
                    setHeaders: {
                    'Authorization': 'Bearer '+aux.token,
                    },
                });
                if (request.url.startsWith(`${RequestInterceptor.BASE_URL}${RequestInterceptor.API_ORDERING}/productOrder`)) {
                    modifiedRequest = request.clone({
                        setHeaders: {
                        'Authorization': 'Bearer '+aux.token,
                        'X-Terms-Accepted': 'true'
                        },
                    });
                }  
                return this.handleStaleSession(request, modifiedRequest, next, aux.token);
            }            
        } else {
            console.log('not logged')
            return next.handle(request);
        } 
    }

    // The proxy keeps tokens in an in-memory cache (2 h, lost on restart). Once a
    // token falls out of it, every request carrying it gets a 401, even public
    // catalog reads, and the portal shows up empty. Drop the dead session and
    // retry the request anonymously.
    private handleStaleSession(request: HttpRequest<any>, modifiedRequest: HttpRequest<any>, next: HttpHandler, token: string): Observable<HttpEvent<any>> {
        return next.handle(modifiedRequest).pipe(
            catchError((err) => {
                // Other 401s (e.g. acting on behalf of a foreign organization) come with a valid token
                if (!(err instanceof HttpErrorResponse) || err.status !== 401 || err.error?.error !== RequestInterceptor.UNKNOWN_TOKEN_ERROR) {
                    return throwError(() => err);
                }
                let current = this.localStorage.getObject('login_items') as LoginInfo;
                if (current.token === token) {
                    // Only the first failing request closes the session
                    this.localStorage.setObject('login_items', {});
                    this.eventMessage.emitSessionExpired();
                }
                // Retrying the session endpoints anonymously makes no sense
                if (request.url.endsWith('/logintoken') || request.url.endsWith('/logout')) {
                    return throwError(() => err);
                }
                return next.handle(request.clone({ headers: request.headers.delete('Authorization') }));
            })
        );
    }
}
