import React, {useState, useEffect, useRef} from 'react';
import {Loader2, AlertCircle, CheckCircle, X} from 'lucide-react';

export const Button = ({children, variant = 'primary', size = 'md', loading, icon: Icon, className = '', disabled, type = 'button', ...props}: any) => {
    const variants = {
        primary: 'bg-emerald-800 text-white hover:bg-emerald-900 shadow-sm',
        secondary: 'bg-white text-stone-800 border border-stone-200 hover:bg-stone-50 shadow-sm',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
        ghost: 'bg-transparent text-stone-600 hover:bg-stone-100',
        outline: 'bg-transparent text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
    };
    
    const sizes = {
        sm: 'px-3 py-1.5 text-xs min-h-[32px]',
        md: 'px-4 py-2 text-sm min-h-[42px]',
        lg: 'px-6 py-3 text-base min-h-[50px]'
    };

    return (
        <button 
            type={type} 
            {...props} 
            disabled={disabled || loading}
            className={`rounded-xl flex items-center justify-center gap-2 font-medium transition-all focus-visible:ring-2 ring-emerald-700/30 ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`}
        >
            {loading && <Loader2 className="animate-spin" size={18} />}
            {Icon && !loading && <Icon size={18} />}
            {children}
        </button>
    );
};

export const inputCls = 'w-full px-4 py-3 border border-stone-200 rounded-xl bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-700 focus:ring-4 ring-emerald-700/10 transition-all text-sm';

export const Field = ({label, hint, children}: {label: string, hint?: string, children: React.ReactNode}) => (
    <div className="space-y-1.5">
        <label className="text-sm font-semibold text-stone-800 ml-1">{label}</label>
        {children}
        {hint && <span className="block text-xs text-stone-500 ml-1">{hint}</span>}
    </div>
);

export const Modal = ({title, children, onClose, footer, hideClose, className = 'max-w-lg'}: any) => {
    const modalRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={onClose} role="dialog" aria-modal="true">
            <div 
                ref={modalRef} 
                className={`bg-white rounded-3xl shadow-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200 ${className}`} 
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-stone-900 leading-tight">{title}</h2>
                    {!hideClose && (
                        <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-600">
                            <X size={20} />
                        </button>
                    )}
                </div>
                <div className="p-6">
                    {children}
                </div>
                {footer && (
                    <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export const ConfirmDialog = ({title, message, confirmLabel='Conferma', danger, onConfirm, onCancel}: any) => (
    <Modal title={title} onClose={onCancel} hideClose className="max-w-md" footer={
        <>
            <Button variant="ghost" onClick={onCancel}>Annulla</Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
    }>
        <p className="text-stone-600 leading-relaxed">{message}</p>
    </Modal>
);

export const Toast = ({message, type, onClose}: {message: string, type: 'success' | 'error', onClose: () => void}) => {
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div role={type === 'error' ? 'alert' : 'status'} className={`fixed bottom-6 right-6 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 duration-300 z-[100] min-w-[300px] ${type === 'success' ? 'bg-white border-l-4 border-emerald-500 text-stone-800' : 'bg-white border-l-4 border-red-500 text-stone-800'}`}>
            <div className={`p-2 rounded-full ${type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            </div>
            <div className="flex-1 font-medium">{message}</div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">
                <X size={16} />
            </button>
        </div>
    );
};

export const Badge = ({type}: {type: string}) => {
    return <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">{type}</span>;
};

export const EmptyState = ({icon: Icon, title, text, action}: any) => (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-stone-200 rounded-3xl shadow-sm">
        <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6">
            <Icon size={40} className="text-stone-300" />
        </div>
        <h3 className="text-xl font-bold text-stone-900 mb-2">{title}</h3>
        <p className="text-stone-500 mb-8 max-w-sm mx-auto leading-relaxed">{text}</p>
        {action && <Button size="lg" onClick={action.onClick}>{action.label}</Button>}
    </div>
);

