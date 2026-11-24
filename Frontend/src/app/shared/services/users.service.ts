import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { User } from './api.models';
import { UsersRepository } from './repositories/users.repository';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly repository = inject(UsersRepository);

  getProfile(): Observable<User> {
    return this.repository.getProfile();
  }
}
