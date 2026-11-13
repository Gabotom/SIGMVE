import { Component, computed, input } from '@angular/core';
import { label, tone } from '../core/labels';

/** Etiqueta de color para estados, severidades y tipos: <app-chip value="en_mantencion" />. */
@Component({
  selector: 'app-chip',
  standalone: true,
  template: `<span class="chip tone-{{ tone() }}">{{ text() }}</span>`,
})
export class ChipComponent {
  value = input<string | null | undefined>();
  text = computed(() => label(this.value()));
  tone = computed(() => tone(this.value()));
}
