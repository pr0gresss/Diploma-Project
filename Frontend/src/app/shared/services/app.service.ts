import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppRepository } from './repositories/app.repository';

@Injectable({ providedIn: 'root' })
export class AppService {
  private readonly repository = inject(AppRepository);

  getRootGreeting(): Observable<string> {
    return this.repository.getRootGreeting();
  }
}
