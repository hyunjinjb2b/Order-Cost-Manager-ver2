import React, { useRef, useState } from 'react';
import {
  FolderOpen,
  FolderSync,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  Info,
  Check
} from 'lucide-react';
import { SharedFolderInfo } from '../types';
import { scanAndParseFolderFiles } from '../utils/mappingEngine';

interface ConnectSharedFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedFolderInfo: SharedFolderInfo;
  onUpdateSharedPath: (path: string) => void;
  onDataLoaded: (data: any) => void;
  onSyncComplete: (info: Partial<SharedFolderInfo>, msg: string) => void;
}

export const ConnectSharedFolderModal: React.FC<ConnectSharedFolderModalProps> = ({
  isOpen,
  onClose,
  sharedFolderInfo,
  onUpdateSharedPath,
  onDataLoaded,
  onSyncComplete,
}) => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const [inputPath, setInputPath] = useState(sharedFolderInfo.path);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [detectedSummary, setDetectedSummary] = useState<any>(null);

  if (!isOpen) return null;

  // 1. 폴더 선택 처리 (HTML5 webkitdirectory)
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const allFiles = Array.from(fileList) as File[];
      const files: File[] = allFiles.filter((f: File) => {
        const name = f.name.toLowerCase();
        return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
      });

      if (files.length === 0) {
        setStatusMessage({
          text: '선택한 폴더 안에 .xlsx 또는 .xls 엑셀 파일이 없습니다. 엑셀 파일이 있는 폴더를 선택해주세요.',
          type: 'error',
        });
        setIsLoading(false);
        return;
      }

      // 첫 번째 파일의 상대경로에서 폴더명 추출
      const firstRelativePath = (files[0] as any).webkitRelativePath || '';
      const folderName = firstRelativePath ? firstRelativePath.split('/')[0] : '공용폴더';

      const scanned = await scanAndParseFolderFiles(files);
      onDataLoaded(scanned.data);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const updatedInfo: Partial<SharedFolderInfo> = {
        name: folderName,
        path: `[사내폴더] ${folderName}`,
        lastSyncTime: `오늘 ${timeStr}`,
        detectedFiles: scanned.detectedFiles,
        totalFilesFound: files.length,
      };

      setInputPath(`[사내폴더] ${folderName}`);
      setDetectedSummary(scanned);
      onSyncComplete(updatedInfo, `✅ 폴더 '${folderName}'에서 엑셀 파일 ${files.length}건을 읽어와 즉시 매핑했습니다!`);
      setStatusMessage({
        text: `✅ 폴더 '${folderName}' 연결 성공! 엑셀 원본 ${files.length}건이 DATA 시트에 실시간 반영되었습니다.`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({
        text: `폴더 파싱 오류: ${err.message || '알 수 없는 오류'}`,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      // reset input
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // 2. 다중 엑셀 파일 선택 처리
  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const files: File[] = Array.from(fileList) as File[];
      const scanned = await scanAndParseFolderFiles(files);
      onDataLoaded(scanned.data);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const updatedInfo: Partial<SharedFolderInfo> = {
        name: '공용폴더 파일',
        path: `[선택된 파일] ${files.length}개 원본`,
        lastSyncTime: `오늘 ${timeStr}`,
        detectedFiles: scanned.detectedFiles,
        totalFilesFound: files.length,
      };

      setDetectedSummary(scanned);
      onSyncComplete(updatedInfo, `✅ 선택된 엑셀 파일 ${files.length}건이 성공적으로 매핑되었습니다!`);
      setStatusMessage({
        text: `✅ 선택된 엑셀 파일 ${files.length}건 매핑 완료! DATA 시트에 실시간 반영되었습니다.`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({
        text: `파일 파싱 오류: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      if (filesInputRef.current) filesInputRef.current.value = '';
    }
  };

  // 3. 경로 직접 저장
  const handleSavePath = () => {
    if (inputPath.trim()) {
      onUpdateSharedPath(inputPath.trim());
      setStatusMessage({
        text: `공용폴더 경로가 '${inputPath.trim()}'(으)로 저장되었습니다.`,
        type: 'info',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Hidden file inputs with 100% browser & iframe compatibility */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderChange}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
      />

      <input
        type="file"
        ref={filesInputRef}
        onChange={handleFilesChange}
        accept=".xlsx,.xls,.csv"
        multiple
        className="hidden"
      />

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">사내 공용폴더 지정 및 실시간 연동</h3>
              <p className="text-xs text-slate-300">내 PC 또는 사내 네트워크 공용 드라이브(Z:\ 등)의 원본 폴더를 지정합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Alert */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 text-rose-900 border-rose-200'
                  : 'bg-blue-50 text-blue-900 border-blue-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Action Choice 1: OS Folder Picker */}
          <div className="p-4 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 transition">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">1. 내 PC / 네트워크 공용폴더 선택 (권장)</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  폴더 선택창이 열리면 훈련내역, 계산서, 통장내역 엑셀이 있는 폴더를 선택하세요.
                </p>
              </div>

              <button
                id="btn-modal-trigger-folder-picker"
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={isLoading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5 shrink-0 disabled:opacity-50"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{isLoading ? '스캔 및 파싱 중...' : '📂 폴더 선택하기'}</span>
              </button>
            </div>
          </div>

          {/* Action Choice 2: Multiple Files Batch Picker */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900">2. 공용폴더 내 엑셀 파일들 직접 다중 선택</h4>
                </div>
                <p className="text-[11px] text-slate-500">
                  폴더 내 파일들을 <code>Ctrl</code> 키 또는 <code>Shift</code> 키로 여러 개 선택하여 한 번에 연동합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => filesInputRef.current?.click()}
                disabled={isLoading}
                className="px-3.5 py-2 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1.5 shrink-0 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>📄 엑셀 파일들 선택</span>
              </button>
            </div>
          </div>

          {/* Action Choice 3: Manual Path Configuration */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-4 h-4 text-slate-600" />
              <h4 className="text-xs font-bold text-slate-900">3. 사내 공용 드라이브 경로(Path) 기록</h4>
            </div>
            <p className="text-[11px] text-slate-500">
              담당자 간 공유되는 네트워크 드라이브 경로를 메모/저장해둘 수 있습니다.
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                placeholder="예: Z:\경영지원\수주관리 또는 C:\공용문서\수주관리"
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={handleSavePath}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition shrink-0"
              >
                경로 저장
              </button>
            </div>
          </div>

          {/* Currently Detected Files Status */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <span className="font-bold text-slate-800 block">현재 연동된 원본 상태</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">1. 훈련내역</span>
                <span className="font-mono font-bold text-blue-600 truncate ml-1">
                  {sharedFolderInfo.detectedFiles.trainingFile?.name || '연동 완료'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">2. 계산서발행</span>
                <span className="font-mono font-bold text-emerald-600 truncate ml-1">
                  {sharedFolderInfo.detectedFiles.invoiceFile?.name || '연동 완료'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">3. 입금내역</span>
                <span className="font-mono font-bold text-amber-600 truncate ml-1">
                  {sharedFolderInfo.detectedFiles.depositFile?.name || '연동 완료'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center space-x-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>선택한 폴더는 브라우저 보안 규정에 따라 안전하게 읽기 전용으로 처리됩니다.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
