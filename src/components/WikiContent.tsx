import React, {useState, useRef, useMemo} from 'react';
import {Archive} from '../types';
import {findRecordByTitle, parseWikiSegments} from '../utils/parser';
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
    const [showDropdown, setShowDropdown] = useState(false);
    const [query, setQuery] = useState('');
    const [openPos, setOpenPos] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const checkAutocomplete = (val: string, pos: number) => {
        const textBeforeCursor = val.substring(0, pos);
        const lastOpenBrackets = textBeforeCursor.lastIndexOf('[[');
        
        if (lastOpenBrackets !== -1) {
            const textSinceOpen = textBeforeCursor.substring(lastOpenBrackets + 2);
            if (!textSinceOpen.includes(']]')) {
                setShowDropdown(true);
                setQuery(textSinceOpen);
                setOpenPos(lastOpenBrackets);
                setSelectedIndex(0);
                return;
            }
        }
        setShowDropdown(false);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const pos = e.target.selectionStart;
        onChange(val);
        checkAutocomplete(val, pos);
    };

    const handleCursorCheck = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        checkAutocomplete(textarea.value, textarea.selectionStart);
    };

    const filteredSuggestions = useMemo(() => {
        if (!showDropdown) return [];
        const q = query.toLowerCase().trim();
        return archive.records
            .filter(r => r.titolo && r.titolo.toLowerCase().includes(q))
            .slice(0, 10);
    }, [archive.records, query, showDropdown]);

    const handleSelectSuggestion = (recordTitle: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const pos = textarea.selectionStart;
        const textBeforeOpen = content.substring(0, openPos);
        const textAfterCursor = content.substring(pos);
        
        const insertion = `[[${recordTitle}]] `;
        const newContent = textBeforeOpen + insertion + textAfterCursor;
        
        onChange(newContent);
        setShowDropdown(false);

        setTimeout(() => {
            textarea.focus();
            const newCursorPos = textBeforeOpen.length + insertion.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showDropdown) return;

        const totalOptions = filteredSuggestions.length + (query.trim() ? 1 : 0);
        if (totalOptions === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % totalOptions);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + totalOptions) % totalOptions);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (selectedIndex < filteredSuggestions.length) {
                if (filteredSuggestions[selectedIndex]) {
                    handleSelectSuggestion(filteredSuggestions[selectedIndex].titolo);
                }
            } else {
                setShowDropdown(false);
                onCreateRecord(query.trim());
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowDropdown(false);
        }
    };

    const renderParsedContent = (text: string) => {
        if (!text) return <span className="text-stone-400 italic">Nessun contenuto</span>;
        const segments = parseWikiSegments(text);

        return (
            <div className="whitespace-pre-wrap leading-relaxed">
                {segments.map((seg, idx) => {
                    if (seg.type === 'text') {
                        return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
                    }
                    const targetTitle = seg.targetTitle || '';
                    const label = seg.label || targetTitle;
                    const targetRec = findRecordByTitle(archive, targetTitle);

                    if (targetRec) {
                        return (
                            <button
                                key={`${targetTitle}-${idx}`}
                                type="button"
                                onClick={() => onSelectRecord(targetRec.id)}
                                className="inline-flex items-center text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 text-sm font-medium transition-colors mx-0.5 cursor-pointer"
                                title={`Vai alla scheda: ${targetRec.titolo}`}
                            >
                                {label}
                            </button>
                        );
                    } else {
                        return (
                            <button
                                key={`create-${targetTitle}-${idx}`}
                                type="button"
                                onClick={() => onCreateRecord(targetTitle)}
                                className="inline-flex items-center text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 text-sm font-medium transition-colors mx-0.5 cursor-pointer group"
                                title={`Crea nuova scheda: ${targetTitle}`}
                            >
                                <span className="mr-1 font-bold">+ Crea:</span> {label}
                            </button>
                        );
                    }
                })}
            </div>
        );
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
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={handleTextChange}
                        onKeyUp={handleCursorCheck}
                        onClick={handleCursorCheck}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder || "Scrivi il contenuto... Usa [[Titolo di un'altra scheda]] per collegarla."}
                        className={className || "w-full border border-stone-200 rounded-2xl p-4 min-h-[320px] text-base focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600"}
                    />
                    {showDropdown && (
                        <div className="absolute z-50 left-4 mt-1 w-80 bg-white border border-stone-200 rounded-xl shadow-xl max-h-64 overflow-y-auto p-1.5 text-sm">
                            <div className="px-2 py-1 text-xs font-semibold text-stone-400 uppercase tracking-wider border-b border-stone-100 mb-1">
                                Schede esistenti {query ? `(Filtro: "${query}")` : ''}
                            </div>
                            {filteredSuggestions.map((rec, idx) => (
                                <button
                                    key={rec.id}
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => handleSelectSuggestion(rec.titolo)}
                                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                                        idx === selectedIndex ? 'bg-amber-50 text-amber-900 font-medium' : 'hover:bg-stone-50 text-stone-700'
                                    }`}
                                >
                                    <span className="truncate">{rec.titolo}</span>
                                    <span className="text-xs px-1.5 py-0.5 bg-stone-100 rounded text-stone-500 ml-2 shrink-0">{rec.tipo}</span>
                                </button>
                            ))}

                            {query.trim() && (
                                <button
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => {
                                        setShowDropdown(false);
                                        onCreateRecord(query.trim());
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-rose-700 hover:bg-rose-50 font-medium transition-colors mt-1 border-t border-stone-100 ${
                                        selectedIndex === filteredSuggestions.length ? 'bg-rose-50' : ''
                                    }`}
                                >
                                    <span className="font-bold">+ Crea nuova scheda:</span> "{query.trim()}"
                                </button>
                            )}

                            {filteredSuggestions.length === 0 && !query.trim() && (
                                <div className="px-3 py-2 text-stone-400 italic text-center">
                                    Nessuna scheda trovata. Digita per cercare.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full border border-stone-200 bg-stone-50/50 rounded-2xl p-4 min-h-[320px] text-base">
                    {renderParsedContent(content)}
                </div>
            )}
        </div>
    );
}
