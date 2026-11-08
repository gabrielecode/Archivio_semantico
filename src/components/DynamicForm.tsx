import React, { useState, useEffect } from 'react';
import { Template, FieldDef } from '../types';
import { ListField, ImageField, VideoField, LinkField, SelectField } from './DynamicFormFields';
import { inputCls, Field, Button } from './ui';
import { ChevronLeft, Info } from 'lucide-react';
import templatesData from '../templates.json';

const templates = templatesData as Template[];

interface DynamicFormProps {
  initialValues?: any;
  templateId?: string;
  onSave: (values: any, template: Template) => void;
  onCancel: () => void;
}

export const DynamicForm = ({ initialValues = {}, templateId, onSave, onCancel }: DynamicFormProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    templates.find(t => t.id === (templateId || initialValues.templateId)) || null
  );
  const [values, setValues] = useState<any>(initialValues.campi || {});

  useEffect(() => {
    if (templateId) {
      const t = templates.find(t => t.id === templateId);
      if (t) setSelectedTemplate(t);
    }
  }, [templateId]);

  const handleFieldChange = (id: string, val: any) => {
    setValues((prev: any) => ({ ...prev, [id]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    onSave(values, selectedTemplate);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {!templateId && !initialValues.templateId && !selectedTemplate && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Info size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">Seleziona Tipologia</h2>
              <p className="text-sm text-stone-500">Scegli il modello di scheda da creare</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className="group flex items-center gap-4 bg-white p-4 rounded-2xl border border-stone-200 text-left transition-all hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5"
              >
                <div 
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm transition-transform group-hover:scale-105" 
                  style={{ backgroundColor: t.cardColor }}
                >
                  {t.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-stone-900 uppercase tracking-tight mb-0.5 truncate">{t.name}</div>
                  <div className="text-[10px] text-stone-500 line-clamp-1">Nuova scheda {t.name.toLowerCase()}</div>
                </div>
                <div className="text-stone-300 group-hover:text-emerald-500 transition-all opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0">
                  <ChevronLeft size={16} className="rotate-180" />
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-center pt-4">
            <Button variant="ghost" onClick={onCancel}>Annulla</Button>
          </div>
        </div>
      )}

      {selectedTemplate && (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden">
            <div 
              className="px-8 py-6 flex items-center justify-between border-b border-stone-100"
              style={{ background: `linear-gradient(to right, ${selectedTemplate.cardColor}08, transparent)` }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" 
                  style={{ backgroundColor: selectedTemplate.cardColor }}
                >
                  {selectedTemplate.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900 leading-tight">Nuova Scheda</h3>
                  <p className="text-sm font-medium opacity-60" style={{ color: selectedTemplate.cardColor }}>{selectedTemplate.name}</p>
                </div>
              </div>
              {!templateId && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>Cambia Tipo</Button>
              )}
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {selectedTemplate.fields.map((f: FieldDef) => {
                  const isFullWidth = f.type === 'textarea' || f.type === 'list' || f.type === 'image' || f.type === 'video' || (f.id.includes('note') || f.id.includes('descrizione'));
                  
                  return (
                    <div key={f.id} className={isFullWidth ? 'md:col-span-2' : ''}>
                      <Field label={f.label} hint={f.required ? 'Obbligatorio' : undefined}>
                        {f.type === 'text' && (
                          <input
                            className={inputCls}
                            required={f.required}
                            value={values[f.id] || ''}
                            onChange={(e) => handleFieldChange(f.id, e.target.value)}
                          />
                        )}
                        {f.type === 'textarea' && (
                          <textarea
                            className={`${inputCls} min-h-[120px] resize-y`}
                            required={f.required}
                            value={values[f.id] || ''}
                            onChange={(e) => handleFieldChange(f.id, e.target.value)}
                          />
                        )}
                        {f.type === 'number' && (
                          <input
                            type="number"
                            className={inputCls}
                            required={f.required}
                            value={values[f.id] || ''}
                            onChange={(e) => handleFieldChange(f.id, e.target.value)}
                          />
                        )}
                        {f.type === 'list' && (
                          <ListField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            fieldColor={selectedTemplate.fieldColor}
                          />
                        )}
                        {f.type === 'image' && (
                          <ImageField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            fieldColor={selectedTemplate.fieldColor}
                          />
                        )}
                        {f.type === 'video' && (
                          <VideoField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            fieldColor={selectedTemplate.fieldColor}
                          />
                        )}
                        {f.type === 'link' && (
                          <LinkField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            fieldColor={selectedTemplate.fieldColor}
                          />
                        )}
                        {f.type === 'select' && (
                          <SelectField
                            value={values[f.id]}
                            onChange={(val: any) => handleFieldChange(f.id, val)}
                            options={f.options}
                            multi={f.multi}
                          />
                        )}
                      </Field>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pb-12">
            <Button variant="ghost" onClick={onCancel} className="w-full sm:w-auto px-8">
              Annulla
            </Button>
            <Button 
              type="submit" 
              size="lg"
              className="w-full sm:w-auto px-12"
              style={{ backgroundColor: selectedTemplate.cardColor }}
            >
              Salva Scheda
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

