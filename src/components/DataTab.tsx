import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Archive, Rec, Template } from '../types';
import { Button, EmptyState } from './ui';
import { ChevronLeft, Save, Trash2, Table as TableIcon, FileText, ChevronRight } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { updateRecordOutlinks } from '../utils/parser';
import { cleanArchive } from '../utils/archive';
import { WikiContent } from './WikiContent';
import { LinkPanel } from './LinkPanel';
import { DynamicForm } from './DynamicForm';
import { CardPreview } from './CardPreview';
import { PronunciationButton } from './PronunciationButton';
import { DataTableView } from './DataTableView';
import { TagManagerPanel } from './TagManagerPanel';
import templatesData from '../templates.json';

const templates = templatesData as Template[];

export function DataTab({
  archive,
  setArchive,
  setDirty,
  selectedId,
  setSelectedId,
  setConfirmDialog,
  onToast,
}: {
  archive: Archive;
  setArchive: (a: Archive | ((a: Archive) => Archive)) => void;
  setDirty: (d: boolean) => void;
  onGoStructure?: () => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setConfirmDialog: (dialog: any) => void;
  onToast?: (m: string) => void;
}) {
  const { t, lang } = useTranslation();
  const [view, setView] = useState<'Modulo' | 'Tabella'>('Modulo');
  const [searchTerm] = useState('');
  const [draft, setDraft] = useState<Rec | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [sortField, setSortField] = useState<keyof Rec>('modificato');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editing, setEditing] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const lastLoadedIdRef = useRef<string | null>(null);

  const filteredRecords = useMemo(() => {
    const recs = [...archive.records].filter(
      (r) =>
        r.titolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.contenuto.toLowerCase().includes(searchTerm.toLowerCase())
    );
    recs.sort((a, b) => {
      const valA = String(a[sortField] ?? '').toLowerCase();
      const valB = String(b[sortField] ?? '').toLowerCase();
      const cmp = valA.localeCompare(valB, lang === 'de' ? 'de' : 'it');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return recs;
  }, [archive.records, searchTerm, sortField, sortDir, lang]);

  const currentIndex = useMemo(
    () => filteredRecords.findIndex((r) => r.id === selectedId),
    [filteredRecords, selectedId]
  );

  const isDirty = useMemo(() => {
    if (!draft || !selectedId) return false;
    const original = archive.records.find((r) => r.id === selectedId);
    if (!original) return isNew;
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [draft, selectedId, archive.records, isNew]);

  const blankRecord = useCallback((): Rec => {
    const tipo = archive.schema.tipi[0] || '';
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      titolo: '',
      tipo,
      categoria: tipo,
      contenuto: '',
      tags: [],
      tag: [],
      outlinks: [],
      fonte: '',
      campi: {},
      images: [],
      creato: now,
      modificato: now,
      embHash: '',
      chunks: [],
    };
  }, [archive.schema.tipi]);

  useEffect(() => {
    if (!selectedId) {
      if (archive.records.length > 0 && !draft) {
        setSelectedId(archive.records[0].id);
        return;
      }
      if (!draft) {
        const newRec = blankRecord();
        lastLoadedIdRef.current = newRec.id;
        setDraft(newRec);
        setIsNew(true);
        setSelectedId(newRec.id);
      }
      return;
    }

    const rec = archive.records.find((r) => r.id === selectedId);
    if (rec && (lastLoadedIdRef.current !== selectedId || !draft)) {
      lastLoadedIdRef.current = selectedId;
      setDraft({ ...rec });
      setIsNew(false);
    }
  }, [selectedId, archive.records, blankRecord, draft, setSelectedId]);

  const handleSave = useCallback(() => {
    if (!draft || !draft.titolo.trim()) return;
    const now = new Date().toISOString();
    const withOutlinks = updateRecordOutlinks(draft);
    const updated = { ...withOutlinks, tag: withOutlinks.tags, modificato: now };
    if (isNew) {
      setArchive((a) => ({ ...a, records: [...a.records, updated] }));
    } else {
      setArchive((a) => ({ ...a, records: a.records.map((r) => (r.id === updated.id ? updated : r)) }));
    }
    lastLoadedIdRef.current = updated.id;
    setDraft(updated);
    setIsNew(false);
    setEditing(false);
    setDirty(true);
    onToast?.('Scheda salvata');
    window.scrollTo({ top: 0 });
  }, [draft, isNew, setArchive, setDirty, onToast]);

  const updateDraftTags = useCallback(
    (nextTags: string[]) => {
      if (!draft) return;
      const next: Rec = {
        ...draft,
        tags: nextTags,
        tag: nextTags,
        modificato: new Date().toISOString(),
      };
      setDraft(next);
      if (!isNew) {
        setArchive((a) => ({
          ...a,
          records: a.records.map((r) => (r.id === draft.id ? next : r)),
        }));
      }
      setDirty(true);
    },
    [draft, isNew, setArchive, setDirty]
  );

  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  const findDuplicate = (titolo: string, tipo: string, excludeId?: string) => {
    const nTitle = norm(titolo);
    const nTipo = norm(tipo);
    return archive.records.find(
      (r) => r.id !== excludeId && norm(r.titolo || '') === nTitle && norm(r.tipo || '') === nTipo
    );
  };

  const showDuplicateDialog = (existing: Rec) => {
    setConfirmDialog({
      title: 'Scheda già esistente',
      message: 'Esiste già una scheda con questo nome. Vuoi aprirla?',
      confirmLabel: 'Apri',
      onConfirm: () => {
        lastLoadedIdRef.current = existing.id;
        setDraft({ ...existing });
        setSelectedId(existing.id);
        setEditing(false);
        setFormDirty(false);
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const handleTemplateSave = (campi: any, template: Template, images?: string[]) => {
    if (!draft) return;
    const now = new Date().toISOString();
    const titleFieldId =
      template.fields.find((f) => f.required && f.type === 'text')?.id ||
      template.fields.find((f) => f.id.includes('nome') || f.id.includes('titolo'))?.id ||
      template.fields.find((f) => f.type === 'text')?.id;
    const titolo = (titleFieldId ? String(campi[titleFieldId] ?? '').trim() : '') || draft.titolo || template.name;

    const existing = findDuplicate(titolo, template.id, draft.id);
    if (existing) {
      showDuplicateDialog(existing);
      return;
    }

    const updated: Rec = {
      ...draft,
      titolo,
      tipo: template.id,
      categoria: template.name,
      campi,
      images: images ?? draft.images ?? [],
      modificato: now,
    };

    const withOutlinks = updateRecordOutlinks(updated);
    setArchive((a) => {
      const exists = a.records.some((r) => r.id === withOutlinks.id);
      return {
        ...a,
        records: exists
          ? a.records.map((r) => (r.id === updated.id ? withOutlinks : r))
          : [...a.records, withOutlinks],
      };
    });

    lastLoadedIdRef.current = withOutlinks.id;
    setDraft(withOutlinks);
    setIsNew(false);
    setFormDirty(false);
    setEditing(false);
    setDirty(true);
    onToast?.('Scheda salvata');
    window.scrollTo({ top: 0 });
  };

  const handleTemplateAutosave = (campi: any, template: Template, images?: string[]): boolean => {
    if (!draft) return false;
    const now = new Date().toISOString();
    const titleFieldId =
      template.fields.find((f) => f.required && f.type === 'text')?.id ||
      template.fields.find((f) => f.id.includes('nome') || f.id.includes('titolo'))?.id ||
      template.fields.find((f) => f.type === 'text')?.id;
    const titolo = titleFieldId ? String(campi[titleFieldId] ?? '').trim() : String(draft.titolo ?? '').trim();
    if (!titolo) return false;

    const existing = findDuplicate(titolo, template.id, draft.id);
    if (existing) {
      return false;
    }

    const updated: Rec = {
      ...draft,
      titolo,
      tipo: template.id,
      categoria: template.name,
      campi,
      images: images ?? draft.images ?? [],
      modificato: now,
    };

    const withOutlinks = updateRecordOutlinks(updated);
    setArchive((a) => {
      const exists = a.records.some((r) => r.id === withOutlinks.id);
      return {
        ...a,
        records: exists
          ? a.records.map((r) => (r.id === withOutlinks.id ? withOutlinks : r))
          : [...a.records, withOutlinks],
      };
    });

    lastLoadedIdRef.current = withOutlinks.id;
    setDraft(withOutlinks);
    setIsNew(false);
    setFormDirty(false);
    setDirty(true);
    return true;
  };

  const handleCreateRecordFromWiki = (title: string) => {
    const tipo = archive.schema.tipi[0] || 'Sintomo';
    const newId = crypto.randomUUID();
    const existing = findDuplicate(title, tipo, newId);
    if (existing) {
      showDuplicateDialog(existing);
      return;
    }
    const newRec: Rec = {
      id: newId,
      titolo: title,
      tipo,
      categoria: tipo,
      contenuto: `Creato automaticamente tramite link da [[${draft?.titolo || ''}]].\n\n`,
      tags: [],
      tag: [],
      outlinks: [],
      fonte: '',
      campi: {},
      images: [],
      creato: new Date().toISOString(),
      modificato: new Date().toISOString(),
      embHash: '',
      chunks: [],
    };
    setArchive((a) => ({ ...a, records: [...a.records, newRec] }));
    setDirty(true);
    lastLoadedIdRef.current = newRec.id;
    setDraft(newRec);
    setSelectedId(newRec.id);
  };

  const createNew = useCallback(() => {
    const newRec = blankRecord();
    lastLoadedIdRef.current = newRec.id;
    setDraft(newRec);
    setIsNew(true);
    setSelectedId(newRec.id);
    setEditing(true);
    setFormDirty(false);
    setView('Modulo');
    setTemplateId(null);
  }, [blankRecord, setSelectedId]);

  const navigate = (direction: number) => {
    if (filteredRecords.length === 0) return;
    const nextIndex = Math.max(0, Math.min(filteredRecords.length - 1, currentIndex + direction));
    const nextRec = filteredRecords[nextIndex];
    if (nextRec) {
      lastLoadedIdRef.current = null;
      setSelectedId(nextRec.id);
    }
  };

  const handleNavigate = (direction: number) => {
    if (isDirty) {
      setConfirmDialog({
        title: t('unsavedChanges'),
        message: t('unsavedChangesMsg'),
        onConfirm: () => {
          handleSave();
          setConfirmDialog(null);
          navigate(direction);
        },
        onCancel: () => {
          setConfirmDialog(null);
          navigate(direction);
        },
      });
    } else {
      navigate(direction);
    }
  };

  const handleNuovo = useCallback(() => {
    if (isDirty) {
      setConfirmDialog({
        title: t('unsavedChanges'),
        message: t('discardAndNewMsg'),
        onConfirm: () => {
          setConfirmDialog(null);
          createNew();
        },
        onCancel: () => setConfirmDialog(null),
      });
    } else {
      createNew();
    }
  }, [isDirty, setConfirmDialog, t, createNew]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (!editing) {
          e.preventDefault();
          handleSave();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNuovo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing, handleSave, handleNuovo]);

  const handleViewChange = (newView: 'Modulo' | 'Tabella') => {
    if (isDirty) {
      setConfirmDialog({
        title: t('unsavedChanges'),
        message: t('unsavedChangesMsg'),
        onConfirm: () => {
          handleSave();
          setConfirmDialog(null);
          setView(newView);
        },
        onCancel: () => {
          setConfirmDialog(null);
          setView(newView);
        },
      });
    } else {
      setView(newView);
    }
  };

  const handleDelete = (targetId?: string) => {
    const idToDelete = targetId ?? selectedId;
    if (!idToDelete) return;
    setConfirmDialog({
      title: t('deleteRecordTitle'),
      message: 'Eliminare questa scheda? Non si può annullare.',
      onConfirm: () => {
        const remaining = archive.records.filter((r) => r.id !== idToDelete);
        setArchive((a) => {
          const deleted = a.records.find((r) => r.id === idToDelete);
          const deletedTitle = (deleted?.titolo || '').trim().toLowerCase();
          return {
            ...a,
            records: a.records
              .filter((r) => r.id !== idToDelete)
              .map((r) => {
                if (!deletedTitle || !r.outlinks?.some((o) => o.trim().toLowerCase() === deletedTitle)) {
                  return r;
                }
                return {
                  ...r,
                  outlinks: r.outlinks.filter((o) => o.trim().toLowerCase() !== deletedTitle),
                };
              }),
          };
        });
        setDirty(true);
        setConfirmDialog(null);
        if (idToDelete === selectedId) {
          setEditing(false);
          if (remaining.length > 0) {
            lastLoadedIdRef.current = null;
            setSelectedId(remaining[0].id);
          } else {
            createNew();
          }
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const handleCleanDuplicates = () => {
    const preview = cleanArchive(archive);
    const removedCount = archive.records.length - preview.records.length;
    if (removedCount === 0) {
      onToast?.('Nessuna scheda doppia o vuota da rimuovere');
      return;
    }
    setConfirmDialog({
      title: 'Pulisci doppioni',
      message: `Verranno rimosse ${removedCount} ${removedCount === 1 ? 'scheda' : 'schede'} (doppie o vuote). Continuare?`,
      confirmLabel: 'Pulisci',
      danger: true,
      onConfirm: () => {
        const cleaned = cleanArchive(archive);
        const actualRemoved = archive.records.length - cleaned.records.length;
        setArchive(() => cleaned);
        setDirty(true);
        if (selectedId && !cleaned.records.some((r) => r.id === selectedId)) {
          if (cleaned.records.length > 0) {
            lastLoadedIdRef.current = null;
            setSelectedId(cleaned.records[0].id);
          } else {
            lastLoadedIdRef.current = null;
            setDraft(null);
            setSelectedId(null);
          }
        }
        setConfirmDialog(null);
        onToast?.(`Rimosse ${actualRemoved} ${actualRemoved === 1 ? 'scheda' : 'schede'}`);
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  if (archive.records.length === 0 && !draft) {
    return (
      <EmptyState
        icon={FileText}
        title="Nessuna scheda presente"
        text="Inizia aggiungendo la tua prima scheda nello schedario."
        action={{ label: 'Aggiungi la prima scheda', onClick: () => createNew() }}
      />
    );
  }

  if (!draft) return null;

  return (
    <div className="space-y-8 text-text-primary text-base">
      <div className="sticky top-[110px] bg-bg-primary/95 z-10 py-4 -mx-6 px-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-card-bg p-4 rounded-3xl border border-border-primary shadow-sm">
            <div className="flex items-center gap-1 bg-bg-alt p-1 rounded-2xl border border-border-primary">
              <Button variant="ghost" size="sm" onClick={() => handleNavigate(-1)} disabled={currentIndex <= 0} className="w-10 h-10 p-0 rounded-xl">
                <ChevronLeft size={20} />
              </Button>
              <div className="px-4 text-xs font-bold text-text-muted tabular-nums">
                {currentIndex >= 0 ? currentIndex + 1 : 0} <span className="opacity-40">/</span> {filteredRecords.length}
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleNavigate(1)} disabled={currentIndex >= filteredRecords.length - 1} className="w-10 h-10 p-0 rounded-xl">
                <ChevronRight size={20} />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden sm:flex bg-bg-alt p-1 rounded-2xl border border-border-primary mr-2">
                <button
                  onClick={() => handleViewChange('Modulo')}
                  className={`p-2 rounded-xl transition-all ${view === 'Modulo' ? 'bg-card-bg text-accent shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                  title={t('viewModule')}
                >
                  <FileText size={20} />
                </button>
                <button
                  onClick={() => handleViewChange('Tabella')}
                  className={`p-2 rounded-xl transition-all ${view === 'Tabella' ? 'bg-card-bg text-accent shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                  title={t('viewTable')}
                >
                  <TableIcon size={20} />
                </button>
              </div>

              {draft && (draft.campi?.['nome_principale'] || draft.campi?.['ideogramma'] || draft.titolo) && (
                <PronunciationButton
                  text={draft.campi?.['ideogramma'] || draft.campi?.['nome_principale'] || draft.titolo}
                  label="Pronuncia"
                  size="sm"
                  variant="secondary"
                  showSpeedToggle={true}
                  className="hidden md:inline-flex"
                  title="Ascolta pronuncia del punto in cinese semplificato"
                />
              )}

              {!editing && (
                <Button variant="secondary" size="sm" onClick={handleCleanDuplicates} title="Rimuovi schede doppie o vuote">
                  Pulisci doppioni
                </Button>
              )}
              {!editing && (
                <Button variant="primary" size="lg" onClick={handleNuovo} className="fixed bottom-28 right-4 z-30 shadow-xl lg:static lg:shadow-none">
                  + Nuova scheda
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete()}
                icon={Trash2}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 px-3 py-2 rounded-xl"
              >
                Elimina
              </Button>
              {!editing && (
                <Button variant="primary" onClick={handleSave} disabled={!isDirty} icon={Save} className="px-8 shadow-lg shadow-emerald-900/10">
                  {isDirty ? 'Salva Modifiche' : 'Salvato'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {view === 'Modulo' ? (
        <div className={`${editing ? 'w-full' : 'grid lg:grid-cols-2 gap-12 items-start'} pt-4`}>
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
            {editing ? (
              <>
                <DynamicForm
                  key={draft.id}
                  initialValues={isNew ? {} : draft}
                  templateId={(isNew ? templateId : templates.some((tpl) => tpl.id === draft.tipo) ? draft.tipo : undefined) || undefined}
                  onSave={handleTemplateSave}
                  onAutosave={handleTemplateAutosave}
                  onDirty={setFormDirty}
                  onCancel={() => {
                    const closeForm = () => {
                      setFormDirty(false);
                      setEditing(false);
                      if (isNew && filteredRecords[0]) {
                        lastLoadedIdRef.current = null;
                        setSelectedId(filteredRecords[0].id);
                      }
                    };
                    if (formDirty) {
                      setConfirmDialog({
                        title: 'Modifiche non salvate',
                        message: 'Uscire senza salvare?',
                        onConfirm: () => {
                          setConfirmDialog(null);
                          closeForm();
                        },
                        onCancel: () => setConfirmDialog(null),
                      });
                    } else {
                      closeForm();
                    }
                  }}
                />
                <TagManagerPanel
                  archive={archive}
                  record={draft}
                  onUpdateTags={updateDraftTags}
                  onToast={onToast}
                />
              </>
            ) : (
              <div className="space-y-8">
                <CardPreview record={draft} />
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setFormDirty(false);
                      setEditing(true);
                    }}
                    className="w-full sm:w-auto px-12 rounded-2xl"
                  >
                    Modifica scheda
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!editing && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-card-bg rounded-[2.5rem] p-8 border border-border-primary shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b border-border-primary pb-4">
                  <div className="w-8 h-8 bg-bg-alt rounded-lg flex items-center justify-center text-text-muted">
                    <FileText size={18} />
                  </div>
                  <h3 className="font-bold text-text-primary tracking-tight">Contenuto Libero &amp; Wiki</h3>
                </div>
                <WikiContent
                  content={draft.contenuto}
                  archive={archive}
                  onSelectRecord={(id) => {
                    lastLoadedIdRef.current = null;
                    setSelectedId(id);
                  }}
                  onCreateRecord={(title) => handleCreateRecordFromWiki(title)}
                  editable={true}
                  onChange={(val) => {
                    const next = { ...draft, contenuto: val };
                    setDraft(next);
                    setArchive((a) => ({
                      ...a,
                      records: a.records.map((r) => (r.id === draft.id ? next : r)),
                    }));
                    setDirty(true);
                  }}
                />
              </div>
              <TagManagerPanel
                archive={archive}
                record={draft}
                onUpdateTags={updateDraftTags}
                onToast={onToast}
              />
              <LinkPanel
                archive={archive}
                currentRecord={draft}
                onSelectRecord={(id) => {
                  lastLoadedIdRef.current = null;
                  setSelectedId(id);
                }}
                onCreateRecord={(title) => handleCreateRecordFromWiki(title)}
              />
            </div>
          )}
        </div>
      ) : (
        <DataTableView
          records={filteredRecords}
          sortField={sortField}
          sortDir={sortDir}
          onSort={(field) => {
            if (sortField === field) {
              setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            } else {
              setSortField(field);
              setSortDir('asc');
            }
          }}
          onSelectRecord={(id) => {
            lastLoadedIdRef.current = null;
            setSelectedId(id);
            setView('Modulo');
          }}
          onEditRecord={(rec) => {
            lastLoadedIdRef.current = rec.id;
            setSelectedId(rec.id);
            setDraft({ ...rec });
            setIsNew(false);
            setFormDirty(false);
            setEditing(true);
            setView('Modulo');
          }}
          onDeleteRecord={(id) => handleDelete(id)}
          searchTerm={searchTerm}
          lang={lang}
          t={t}
        />
      )}
    </div>
  );
}
