import type { ReactNode } from 'react';

/** A chip that is really a checkbox or radio: keyboard and screen readers work as usual. */
export function ChoiceChip({ type, name, value, label, defaultChecked }: {
  type: 'checkbox' | 'radio'; name: string; value: string; label: string; defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-[15px] font-bold
        transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white
        peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30 hover:border-ink-2">
        {label}
      </span>
    </label>
  );
}

export function ChoiceGroup({ title, help, error, children }: {
  title: string; help?: string; error?: string; children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-lg font-extrabold">{title}</legend>
      {help && <p className="-mt-1 text-sm text-muted">{help}</p>}
      <div className="flex flex-wrap gap-2.5">{children}</div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </fieldset>
  );
}
