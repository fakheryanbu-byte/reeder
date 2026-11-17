import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneNumberInput } from '../src/components/PhoneNumberInput';

describe('PhoneNumberInput component', () => {
  it('renders separated +966 dial code, divider, and local phone input with lock protection', () => {
    const html = renderToStaticMarkup(
      <PhoneNumberInput
        id="guest-mobile-number"
        value="+966501234567"
        onChange={vi.fn()}
        placeholder="5XXXXXXXX"
        phoneAriaLabel="رقم الجوال"
        dialCodeLabel="مفتاح الدولة"
        editLabel="تعديل"
        lockLabel="تثبيت"
      />
    );

    expect(html).toContain('+966');
    expect(html).toContain('value="501234567"');
    expect(html).toContain('aria-label="تعديل مفتاح الدولة"');
    expect(html).toContain('w-px self-stretch bg-[#2C2C2C]/20');
  });

  it('keeps country code isolated even when local number is empty', () => {
    const html = renderToStaticMarkup(
      <PhoneNumberInput
        id="hotel-reg-phone"
        value="+966"
        onChange={vi.fn()}
        placeholder="5XXXXXXXX"
        phoneAriaLabel="رقم جوال الاستقبال"
        dialCodeLabel="مفتاح الدولة"
        editLabel="تعديل"
        lockLabel="تثبيت"
      />
    );

    expect(html).toContain('+966');
    expect(html).toContain('value=""');
    expect(html).toContain('placeholder="5XXXXXXXX"');
  });
});
