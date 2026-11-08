import React, {useState, useEffect, useRef} from 'react';
import {Loader2, AlertCircle, CheckCircle, X} from 'lucide-react';

export const Button = ({children, variant = 'primary', size = 'md', loading, icon: Icon, className = '', disabled, type = 'button', ...props}: any) => {
    const variants = {
        primary: 'bg-accent text-white hover:bg-accent-hover shadow-sm',
        secondary: 'bg-card-bg text-text-primary border border-border-primary hover:bg-bg-alt shadow-sm',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
        ghost: 'bg-transparent text-text-muted hover:bg-bg-alt',
        outline: 'bg-transparent text-accent border border-accent/20 hover:bg-accent/10'
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
            className={`rounded-xl flex items-center justify-center gap-2 font-medium transition-all focus-visible:ring-2 ring-accent/30 ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`}
        >
            {loading && <Loader2 className="animate-spin" size={18} />}
            {Icon && !loading && <Icon size={18} />}
            {children}
        </button>
    );
};

export const inputCls = 'w-full px-4 py-3 border border-border-primary rounded-xl bg-card-bg text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent focus:ring-4 ring-accent/10 transition-all text-sm';

export const Field = ({label, hint, children}: {label: string, hint?: string, children: React.ReactNode}) => (
    <div className="space-y-1.5">
        <label className="text-sm font-semibold text-text-primary ml-1">{label}</label>
        {children}
        {hint && <span className="block text-xs text-text-muted ml-1">{hint}</span>}
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
                className={`bg-card-bg rounded-3xl shadow-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200 ${className}`} 
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
                    <h2 className="text-xl font-bold text-text-primary leading-tight">{title}</h2>
                    {!hideClose && (
                        <button onClick={onClose} className="p-2 hover:bg-bg-alt rounded-full transition-colors text-text-muted hover:text-text-primary">
                            <X size={20} />
                        </button>
                    )}
                </div>
                <div className="p-6">
                    {children}
                </div>
                {footer && (
                    <div className="px-6 py-4 bg-bg-alt border-t border-border-primary flex justify-end gap-3">
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
        <p className="text-text-muted leading-relaxed">{message}</p>
    </Modal>
);

export const Toast = ({message, type, onClose}: {message: string, type: 'success' | 'error', onClose: () => void}) => {
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
    return (
        <div role={type === 'error' ? 'alert' : 'status'} className={`fixed bottom-6 right-6 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 duration-300 z-[100] min-w-[300px] ${type === 'success' ? 'bg-card-bg border-l-4 border-emerald-500 text-text-primary' : 'bg-card-bg border-l-4 border-red-500 text-text-primary'}`}>
            <div className={`p-2 rounded-full ${type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            </div>
            <div className="flex-1 font-medium">{message}</div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
                <X size={16} />
            </button>
        </div>
    );
};

export const Badge = ({type}: {type: string}) => {
    return <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-bg-alt text-text-muted border border-border-primary">{type}</span>;
};

export const EmptyState = ({icon: Icon, title, text, action}: any) => (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-card-bg border border-border-primary rounded-3xl shadow-sm">
        <div className="w-20 h-20 bg-bg-alt rounded-full flex items-center justify-center mb-6">
            <Icon size={40} className="text-text-muted/30" />
        </div>
        <h3 className="text-xl font-bold text-text-primary mb-2">{title}</h3>
        <p className="text-text-muted mb-8 max-w-sm mx-auto leading-relaxed">{text}</p>
        {action && <Button size="lg" onClick={action.onClick}>{action.label}</Button>}
    </div>
);

