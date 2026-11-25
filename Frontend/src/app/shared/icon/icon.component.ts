import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type IconName =
  | 'arrow'
  | 'arrow-light'
  | 'arrow-white'
  | 'book'
  | 'check'
  | 'check-green'
  | 'chevron'
  | 'chevron-activity'
  | 'chevron-small'
  | 'clock'
  | 'dots'
  | 'dots-row'
  | 'dots-small'
  | 'file'
  | 'grid'
  | 'help'
  | 'note'
  | 'note-activity'
  | 'pencil'
  | 'plus'
  | 'plus-small'
  | 'plus-white'
  | 'quiz'
  | 'quiz-activity'
  | 'search'
  | 'search-small'
  | 'settings'
  | 'star'
  | 'upload'
  | 'upload-green';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      [src]="src()"
      [alt]="label() || ''"
      [attr.aria-hidden]="label() ? null : 'true'"
      [style.width.px]="size()"
      [style.height.px]="size()"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }

    img {
      display: block;
      max-width: none;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly label = input('');
  readonly src = computed(() => `/icons/${this.name()}.svg`);
}
