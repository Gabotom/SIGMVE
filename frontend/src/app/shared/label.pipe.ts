import { Pipe, PipeTransform } from '@angular/core';
import { label } from '../core/labels';

/** {{ 'en_mantencion' | label }} -> "En mantención" */
@Pipe({ name: 'label', standalone: true })
export class LabelPipe implements PipeTransform {
  transform(value: string | null | undefined) { return label(value); }
}
