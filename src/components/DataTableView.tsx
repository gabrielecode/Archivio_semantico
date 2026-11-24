import React from 'react';
import { Rec } from '../types';
import { Button } from './ui';
import { Pencil, Trash2 } from 'lucide-react';

interface DataTableViewProps {
  records: Rec[];
  sortField: keyof Rec;
  sortDir: 'asc' | 'desc';
  onSort: (field: keyof Rec) => void;
  onSelectRecord: (id: string) => void;
  onEditRecord: (rec: Rec) => void;
  onDeleteRecord: (id: string) => void;
  searchTerm: string;
  lang: string;
  t: (key: string) => string;
}

export function DataTableView({
  records,
  sortField,
  sortDir,
  onSort,
  onSelectRecord,
  onEditRecord,
  onDeleteRecord,
  searchTerm,
  lang,
  t,
}: DataTableViewProps) {
  const sortIndicator = (field: keyof Rec) => {
    if (sortField !== field) return null;
    return <span className="ml-1 text-accent">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-card-bg border border-border-primary rounded-[2rem] shadow-sm overflow-x-auto max-h-[70vh] overflow-y-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-bg-alt/80 text-text-muted text-xs font-semibold border-b border-border-primary">
            <th
              className="px-6 py-4 cursor-pointer hover:text-text-primary transition-colors select-none"
              onClick={() => onSort('titolo')}
            >
              {t('titleLabel').replace('*', '')}
              {sortIndicator('titolo')}
            </th>
            <th
              className="px-5 py-4 cursor-pointer hover:text-text-primary transition-colors select-none"
              onClick={() => onSort('tipo')}
            >
              {t('typeLabel')}
              {sortIndicator('tipo')}
            </th>
            <th className="px-5 py-4">{t('tagsLabel')}</th>
            <th
              className="px-6 py-4 cursor-pointer hover:text-text-primary transition-colors text-right select-none"
              onClick={() => onSort('modificato')}
            >
              {lang === 'de' ? 'Geändert' : 'Modificato'}
              {sortIndicator('modificato')}
            </th>
            <th className="px-6 py-4 text-right">Azioni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary/60">
          {records.map((r) => (
            <tr
              key={r.id}
              className="group hover:bg-bg-alt/60 cursor-pointer transition-colors"
              onClick={() => onSelectRecord(r.id)}
            >
              <td className="px-6 py-3.5">
                <div className="font-semibold text-text-primary group-hover:text-accent transition-colors">
                  {r.titolo}
                </div>
              </td>
              <td className="px-5 py-3.5 text-xs text-text-muted font-medium">{r.tipo}</td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                  {r.tags.slice(0, 3).map((tag, idx) => (
                    <React.Fragment key={tag}>
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span>#{tag}</span>
                    </React.Fragment>
                  ))}
                  {r.tags.length > 3 && <span className="opacity-70">+{r.tags.length - 3}</span>}
                </div>
              </td>
              <td className="px-6 py-3.5 text-right">
                <span className="text-text-muted font-mono tabular-nums text-xs">
                  {new Date(r.modificato).toLocaleDateString(lang === 'de' ? 'de-DE' : 'it-IT')}
                </span>
              </td>
              <td className="px-6 py-3.5 text-right">
                <div className="inline-flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Pencil}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onEditRecord(r);
                    }}
                    className="text-text-primary hover:bg-bg-alt px-3 py-1.5 rounded-xl"
                  >
                    Modifica
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onDeleteRecord(r.id);
                    }}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 px-3 py-1.5 rounded-xl"
                  >
                    Elimina
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length === 0 && (
        <div className="p-20 text-center text-text-muted font-medium italic">
          Nessun risultato trovato{searchTerm ? ` per "${searchTerm}"` : ''}
        </div>
      )}
    </div>
  );
}
