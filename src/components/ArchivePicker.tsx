import {useState, useEffect} from 'react';
import {Archive} from '../types';
import {Button, Modal, ConfirmDialog} from './ui';
import {Store, storageInfo} from '../utils/store';
import {exportArchiveJson, pickJsonFile} from '../utils/archive';

export function ArchivePicker({store, currentId, onOpen, onCreate, onImported, onClose, toast}: {
    store: Store, currentId: string | null, onOpen: (id: string) => void, onCreate: () => void, onImported: (a: Archive) => void, onClose: () => void, toast: (msg: string, type: 'success' | 'error') => void
}) {
    const [list, setList] = useState<{id: string, nome: string, modificato: string, count: number}[]>([]);
    const [info, setInfo] = useState<{usage: number, quota: number} | null>(null);
    const [confirm, setConfirm] = useState<any>(null);

    const refresh = async () => {
        setList(await store.list());
        const info = await storageInfo();
        if (info) setInfo({usage: info.usage || 0, quota: info.quota || 0});
    };
    useEffect(() => { refresh(); }, []);

    const deleteArchive = async (id: string) => {
        await store.remove(id);
        refresh();
        toast('Archivio eliminato', 'success');
    };

    return (
        <Modal title="Archivi" onClose={onClose} footer={
            <div className="flex justify-between w-full">
                <div className="text-xs text-stone-500 pt-2">
                    {info ? `${(info.usage/1024/1024).toFixed(1)} MB di ${(info.quota/1024/1024).toFixed(1)} MB usati` : ''}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={async () => {
                        try {
                            const a = await pickJsonFile();
                            if (a) { onImported(a); onClose(); }
                        } catch (e: any) { toast(e.message, 'error'); }
                    }}>Importa JSON</Button>
                    <Button onClick={onCreate}>Nuovo archivio</Button>
                </div>
            </div>
        }>
            <div className="space-y-2">
                {list.map(item => (
                    <div key={item.id} className={`flex items-center justify-between p-2 rounded border ${currentId === item.id ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50'}`}>
                        <div>
                            <div className="font-semibold">{item.nome} {currentId === item.id && <span className="text-xs bg-emerald-100 text-emerald-700 px-1 rounded">aperto</span>}</div>
                            <div className="text-xs text-stone-500">{item.count} voci • mod. {new Date(item.modificato).toLocaleString('it-IT')}</div>
                        </div>
                        <div className="flex gap-1">
                            {currentId !== item.id && <Button variant="ghost" size="sm" onClick={() => { onOpen(item.id); onClose(); }}>Apri</Button>}
                            <Button variant="ghost" size="sm" onClick={async () => {
                                const a = await store.get(item.id);
                                if (a) exportArchiveJson(a);
                            }}>JSON</Button>
                            {currentId !== item.id && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirm({
                                title: 'Eliminare archivio?',
                                message: `Vuoi eliminare ${item.nome}?`,
                                onConfirm: () => { setConfirm(null); deleteArchive(item.id); },
                                onCancel: () => setConfirm(null)
                            })}>Elimina</Button>}
                        </div>
                    </div>
                ))}
            </div>
            {confirm && <ConfirmDialog {...confirm} />}
        </Modal>
    );
}
