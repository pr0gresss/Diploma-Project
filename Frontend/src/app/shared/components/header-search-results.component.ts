import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import type { HeaderSearchResult } from '../services/header-search.service';

@Component({
  selector: 'app-header-search-results',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header-search-results.component.html',
  styleUrl: './header-search-results.component.scss',
})
export class HeaderSearchResultsComponent {
  readonly results = input<HeaderSearchResult[]>([]);
  readonly query = input('');
  readonly loading = input(false);
  readonly pending = input(false);

  readonly select = output<HeaderSearchResult>();
}
