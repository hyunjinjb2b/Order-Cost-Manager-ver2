import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Building2, Pencil, Plus, X } from 'lucide-react';
import { TrainingCenter } from '../types';

interface AddTrainingCenterModalProps {
  isOpen: boolean;
  centers: TrainingCenter[];
  editingCenter?: TrainingCenter | null;
  onClose: () => void;
  onAdd: (name: string) => void;
  onRename?: (centerId: string, name: string) => void;
}

export const AddTrainingCenterModal: React.FC<AddTrainingCenterModalProps> = ({
  isOpen,
  centers,
  editingCenter,
  onClose,
  onAdd,
  onRename,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(editingCenter?.name ?? '');
    setError('');
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, editingCenter, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('연수원 이름을 입력해주세요.');
      inputRef.current?.focus();
      return;
    }
    if (centers.some((center) => center.id !== editingCenter?.id && center.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
      setError('같은 이름의 연수원이 이미 있습니다.');
      inputRef.current?.focus();
      return;
    }

    if (editingCenter) {
      onRename?.(editingCenter.id, trimmedName);
    } else {
      onAdd(trimmedName);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <form
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-center-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="add-center-title" className="text-base font-bold text-slate-900">
                {editingCenter ? '연수원명 편집' : '새 연수원 추가'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {editingCenter ? '이름만 변경되며 기존 데이터는 그대로 유지됩니다.' : '독립된 데이터 작업공간이 생성됩니다.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5">
          <label htmlFor="training-center-name" className="mb-2 block text-sm font-bold text-slate-700">연수원 이름</label>
          <input
            ref={inputRef}
            id="training-center-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError('');
            }}
            placeholder="예: 서울 연수원"
            maxLength={40}
            className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
              error ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
            }`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'training-center-error' : undefined}
          />
          {error && <p id="training-center-error" className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            {editingCenter
              ? '연수원명을 변경해도 훈련내역, 계산서, 입금내역, 매핑 사전과 공용폴더 연결 정보는 유지됩니다.'
              : '새 연수원의 훈련내역, 계산서, 입금내역, 매핑 사전과 공용폴더 설정은 다른 연수원과 분리됩니다.'}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
            취소
          </button>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-500 active:bg-blue-700">
            {editingCenter ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingCenter ? '이름 저장' : '연수원 추가'}
          </button>
        </div>
      </form>
    </div>
  );
};
