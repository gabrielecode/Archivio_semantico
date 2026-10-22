import React, {useState} from 'react';
import {Archive} from '../types';
import {findRecordByTitle} from '../utils/parser';
import {Eye, Edit3} from 'lucide-react';
import {Button} from './ui';

interface WikiContentProps {
    content: string;
    archive: Archive;
    onSelectRecord: (id: string) => void;
    onCreateRecord: (title: string) => void;
    editable: boolean;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
}

export function WikiContent({
    content,
    archive,
    onSelectRecord,
    onCreateRecord,
    editable,
    onChange,
    placeholder,
    className
}: WikiContentProps) {
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');

    const renderParsedContent = (text: string) => {
        if (!text) return <span className="text-stone-400 italic">Nessun contenuto</span>;
        const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const fullMatch = match[0];
            const targetTitle = match[1].trim();
            const label = match[2] ? match[2].trim() : targetTitle;
            const matchIndex = match.index;

            if (matchIndex > lastIndex) {
                parts.push(text.substring(lastIndex, matchIndex));
            }

            const targetRec = findRecordByTitle(archive, targetTitle);
            if (targetRec) {
                parts.push(
                    <button
                        key={`${targetTitle}-${matchIndex}`}
                        type="button"
                        onClick={() => onSelectRecord(targetRec.id)}
                        className="inline-flex items-center text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 text-sm font-medium transition-colors mx-0.5 cursor-pointer"
                        title={`Vai alla scheda: ${targetRec.titolo}`}
                    >
                        {label}
                    </button>
                );
            } else {
                parts.push(
                    <button
                        key={`create-${targetTitle}-${matchIndex}`}
                        type="button"
                        onClick={() => onCreateRecord(targetTitle)}
                        className="inline-flex items-center text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 text-sm font-medium transition-colors mx-0.5 cursor-pointer group"
                        title={`Crea nuova scheda: ${targetTitle}`}
                    >
                        <span className="mr-1 font-bold">+ Crea:</span> {label}
                    </button>
                );
            }

            lastIndex = matchIndex + fullMatch.length;
        }

        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return <div className="whitespace-pre-wrap leading-relaxed">{parts}</div>;
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Contenuto (supporta [[WikiLink]])</span>
                <div className="flex bg-stone-100 rounded-lg p-0.5">
                    <Button 
                        variant={mode === 'edit' ? 'primary' : 'ghost'} 
                        onClick={() => setMode('edit')}
                        className="text-xs py-1 px-2 h-7"
                    >
                        <Edit3 size={12} className="mr-1" /> Modifica
                    </Button>
                    <Button 
                        variant={mode === 'preview' ? 'primary' : 'ghost'} 
                        onClick={() => setMode('preview')}
                        className="text-xs py-1 px-2 h-7"
                    >
                        <Eye size={12} className="mr-1" /> Anteprima Link
                    </Button>
                </div>
            </div>

            {mode === 'edit' ? (
                <textarea
                    value={content}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder || "Scrivi il contenuto... Usa [[Titolo di un'altra scheda]] per collegarla."}
                    className={className || "w-full border border-stone-200 rounded-2xl p-4 min-h-[320px] text-base focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600"}
                />
            ) : (
                <div className="w-full border border-stone-200 bg-stone-50/50 rounded-2xl p-4 min-h-[320px] text-base">
                    {renderParsedContent(content)}
                </div>
            )}
        </div>
    );
}
