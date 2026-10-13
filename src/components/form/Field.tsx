import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? 'field--wide' : ''}`}><span>{label}</span>{children}</label>;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; wide?: boolean; options?: string[] };

/** Input con etiqueta; `options` añade autocompletado con valores existentes. */
export function TextField({ label, wide, options, ...rest }: InputProps) {
  const listId = options ? `dl-${label.replace(/\W/g, '')}` : undefined;
  return (
    <Field label={label} wide={wide}>
      <input {...rest} list={listId} />
      {options && <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>}
    </Field>
  );
}

export function TextArea({ label, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <Field label={label} wide><textarea rows={3} {...rest} /></Field>;
}
