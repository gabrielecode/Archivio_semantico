import React, {useState, useEffect, useRef} from 'react';
import {Loader2, AlertCircle, CheckCircle} from 'lucide-react';

export const Button = ({children, variant = 'primary', loading, icon: Icon, className = '', disabled, type = 'button', ...props}: any) => {
    const variants = {
        primary: 'bg-emerald-700 text-white hover:bg-emerald-800',
        secondary: 'bg-stone-200 text-stone-800 hover:bg-stone-300',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        ghost: 'bg-transparent text-stone-700 hover:bg-stone-100'
    };
    return (
        <button 
            type={type} 
            {...props} 
            disabled={disabled || loading}
            className={`px-4 py-2 rounded-lg flex items-center justify-center gap-2 min-h-[40px] focus-visible:ring-2 ring-emerald-700 ${variants[variant as keyof typeof variants]} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
            {loading && <Loader2 className="animate-spin" size={16} />}
            {Icon && !loading && <Icon size={16} />}
            {children}
        </button>
    );
};

export const inputCls = 'w-full p-2 border border-stone-300 rounded-lg bg-white focus:border-emerald-700 focus:ring-1 ring-emerald-700';

export const Field = ({label, hint, children}: {label: string, hint?: string, children: React.ReactNode}) => (
    <label className="block space-y-1">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {hint && <span className="block text-xs text-stone-500">{hint}</span>}
        {children}
    </label>
);

export const Modal = ({title, children, onClose, footer, hideClose}: any) => {
    const modalRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const prev = document.activeElement as HTMLElement;
        const focusable = modalRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable && focusable.length > 0) (focusable[0] as HTMLElement).focus();
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Tab') {
                const focusable = modalRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (!focusable || focusable.length === 0) return;
                const first = focusable[0] as HTMLElement;
                const last = focusable[focusable.length - 1] as HTMLElement;
                if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
                else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('keydown', handleKeyDown); prev?.focus(); };
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div ref={modalRef} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 id="modal-title" className="text-xl font-serif mb-4">{title}</h2>
                {children}
                {(footer || !hideClose) && (
                    <div className="flex justify-end gap-2 mt-6">
                        {footer}
                        {!hideClose && <Button onClick={onClose} variant="ghost">Chiudi</Button>}
                    </div>
                )}
            </div>
        </div>
    );
};

export const ConfirmDialog = ({title, message, confirmLabel='Conferma', danger, onConfirm, onCancel}: any) => (
    <Modal title={title} onClose={onCancel} hideClose>
        <p className="text-stone-600">{message}</p>
        <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={onCancel}>Annulla</Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
    </Modal>
);

export const Toast = ({message, type, onClose}: {message: string, type: 'success' | 'error', onClose: () => void}) => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => { const timer = setTimeout(() => onCloseRef.current(), 4000); return () => clearTimeout(timer); }, []);
    return (
        <div role={type === 'error' ? 'alert' : 'status'} className={`fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 p-4 rounded-lg shadow-lg flex items-center gap-2 ${type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {message}
        </div>
    );
};

export const Badge = ({type}: {type: string}) => {
    const colors = ['bg-red-100 text-red-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-yellow-100 text-yellow-800', 'bg-purple-100 text-purple-800', 'bg-pink-100 text-pink-800', 'bg-indigo-100 text-indigo-800', 'bg-teal-100 text-teal-800'];
    const index = [...type].reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return <span title={type} className={`px-2 py-0.5 rounded text-xs ${colors[index]}`}>{type}</span>;
};

export const EmptyState = ({icon: Icon, title, text, action}: any) => (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-stone-200 rounded-xl">
        <Icon size={48} className="text-stone-400 mb-4" />
        <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
        <p className="text-stone-600 mb-4">{text}</p>
        {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
);
