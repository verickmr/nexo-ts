'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, LoaderCircle } from 'lucide-react';
export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={`brand ${light ? 'brand-light' : ''}`}>
      <svg
        aria-hidden="true"
        className="brand-mark"
        width="24"
        height="24"
        viewBox="0 0 28 26"
        fill="none"
      >
        <path
          transform="translate(1.8 2.7)"
          d="M21.763.24493l-3.374 1.687c-.623.308-.973.903-.973 1.631v6.293L6.223.42693c-.623-.469-1.372-.553-2.03-.245l-3.185 1.631C.357 2.13493 0 2.73693 0 3.48593v15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c.693-.322 1.057-.952 1.057-1.722v-7.7l11.732 10.591c.602.546 1.421.679 2.086.364l2.786-1.505c.602-.315.938-.931.938-1.68v-15.288c0-1.463-1.505-2.275-2.625-1.687Z"
          fill="currentColor"
        />
      </svg>
      {!compact && <span>Nexo Assist</span>}
    </span>
  );
}
export const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
export function Avatar({
  name,
  size = '',
  color = 0,
}: {
  name: string;
  size?: string;
  color?: number;
}) {
  return <span className={`avatar ${size} avatar-${color % 5}`}>{initials(name)}</span>;
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Spinner() {
  return <LoaderCircle size={16} className="spin" aria-label="Carregando" />;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function time(value: string, full = false) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...(full
      ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { hour: '2-digit', minute: '2-digit' }),
  }).format(new Date(value));
}
export function relative(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  return `há ${Math.floor(minutes / 1440)} dias`;
}
export async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.includes('/auth/')) window.location.assign('/entrar');
    throw new Error(data.error || 'Não foi possível concluir.');
  }
  return data as T;
}
