import React, { useState, useEffect } from 'react';
import { Template, FieldDef } from '../types';
import { ListField, ImageField, VideoField, LinkField, SelectField } from './DynamicFormFields';
import { inputCls, Field } from './ui';
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
    <div className="space-y-6">
      {!templateId && !initialValues.templateId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                selectedTemplate?.id === t.id 
                  ? 'border-stone-900 bg-stone-50 shadow-sm' 
                  : 'border-stone-100 hover:border-stone-300'
              }`}
            >
              <div className="w-8 h-8 rounded-lg mb-2" style={{ backgroundColor: t.cardColor }} />
              <div className="text-xs font-bold text-stone-900 uppercase truncate">{t.name}</div>
            </button>
          ))}
        </div>
      )}

      {selectedTemplate && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 rounded-xl border-t-8 shadow-sm bg-white" style={{ borderTopColor: selectedTemplate.cardColor }}>
            <h3 className="text-lg font-serif font-bold text-stone-900 mb-6 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTemplate.cardColor }} />
              Nuova Scheda {selectedTemplate.name}
            </h3>

            <div className="space-y-6">
              {selectedTemplate.fields.map((f: FieldDef) => (
                <Field key={f.id} label={f.label} hint={f.required ? 'Obbligatorio' : undefined}>
                  {f.type === 'text' && (
                    <input
                      className={inputCls}
                      required={f.required}
                      value={values[f.id] || ''}
                      onChange={(e) => handleFieldChange(f.id, e.target.value)}
                      style={{ borderLeftColor: selectedTemplate.fieldColor, borderLeftWidth: values[f.id] ? '4px' : '1px' }}
                    />
                  )}
                  {f.type === 'textarea' && (
                    <textarea
                      className={`${inputCls} min-h-[100px] resize-y`}
                      required={f.required}
                      value={values[f.id] || ''}
                      onChange={(e) => handleFieldChange(f.id, e.target.value)}
                      style={{ borderLeftColor: selectedTemplate.fieldColor, borderLeftWidth: values[f.id] ? '4px' : '1px' }}
                    />
                  )}
                  {f.type === 'number' && (
                    <input
                      type="number"
                      className={inputCls}
                      required={f.required}
                      value={values[f.id] || ''}
                      onChange={(e) => handleFieldChange(f.id, e.target.value)}
                      style={{ borderLeftColor: selectedTemplate.fieldColor, borderLeftWidth: values[f.id] ? '4px' : '1px' }}
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
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 sticky bottom-0 bg-white/80 backdrop-blur p-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 font-medium"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-8 py-2 rounded-lg text-white font-bold shadow-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: selectedTemplate.cardColor }}
            >
              Salva Scheda
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
