import { TestBed } from '@angular/core/testing';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { ClDateAdapter } from './cl-date-adapter';

describe('ClDateAdapter', () => {
  let adapter: ClDateAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ClDateAdapter, { provide: MAT_DATE_LOCALE, useValue: 'es-CL' }] });
    adapter = TestBed.inject(ClDateAdapter);
  });

  it('entiende fechas escritas como dd-MM-yyyy y dd/MM/yyyy', () => {
    for (const text of ['10-11-2026', '10/11/2026']) {
      const d = adapter.parse(text, null)!;
      expect([d.getDate(), d.getMonth() + 1, d.getFullYear()]).toEqual([10, 11, 2026]);
    }
  });

  it('rechaza fechas imposibles', () => {
    expect(adapter.isValid(adapter.parse('31-02-2026', null)!)).toBeFalse();
  });
});
