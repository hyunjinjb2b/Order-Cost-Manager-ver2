import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Layers,
  FolderSync,
  FolderOpen,
  HardDrive,
  Clock,
  Sparkles,
  Check,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { TrainingRecord, CompanyMapping, DepositorMapping, InvoiceRecord, DepositRecord, SharedFolderInfo } from '../types';

interface UploadManagerProps {
  onDataLoaded: (data: {
    trainings?: TrainingRecord[];
    companyMappings?: CompanyMapping[];
    depositorMappings?: DepositorMapping[];
    invoices?: InvoiceRecord[];
    deposits?: DepositRecord[];
  }) => void;
  trainingsCount: number;
  companyMappingsCount: number;
  depositorMappingsCount: number;
  invoicesCount: number;
  depositsCount: number;
  onGoToDataSheet: () => void;
  sharedFolderInfo: SharedFolderInfo;
  onConnectDirectory: () => Promise<void>;
  onRefreshSharedFolder: () => Promise<void>;
  onUpdateSharedPath: (path: string) => void;
  isRefreshing: boolean;
  directoryHandleConnected: boolean;
  onClearAllData?: () => void;
}

export const UploadManager: React.FC<UploadManagerProps> = ({
  trainingsCount,
  companyMappingsCount,
  depositorMappingsCount,
  invoicesCount,
  depositsCount,
  onGoToDataSheet,
  sharedFolderInfo,
  onConnectDirectory,
  onRefreshSharedFolder,
  onUpdateSharedPath,
  isRefreshing,
  directoryHandleConnected,
  onClearAllData,
}) => {
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [inputPath, setInputPath] = useState(sharedFolderInfo.path);

  const handleSavePath = () => {
    if (inputPath.trim()) {
      onUpdateSharedPath(inputPath.trim());
    }
    setIsEditingPath(false);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatModifiedTime = (timestamp?: number) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-5">
      {/* 1. 공용 폴더 연동 & 새로고침 Hero Card */}
      <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                  <FolderSync className="w-5 h-5" />
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  사내 공용폴더 원본 파일 자동 동기화 & 실시간 새로고침
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{directoryHandleConnected ? '공용폴더 연결됨 (실시간 동기화)' : '공용폴더 연동 활성화'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
                사내 공용 드라이브에 매월 <strong>훈련내역, 계산서발행내역, 입금내역</strong> 원본 엑셀을 저장해두면,
                <strong>[공용폴더 원본 새로고침]</strong> 버튼 클릭 한 번으로 최신 파일들을 자동 감지하여 DATA 시트에 즉시 매핑합니다.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-hero-refresh-folder"
                onClick={onRefreshSharedFolder}
                disabled={isRefreshing}
                className="flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                title="공용폴더 내 최신 엑셀 파일들을 다시 스캔하여 즉시 반영합니다."
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? '동기화 중...' : '🔄 공용폴더 원본 새로고침'}</span>
              </button>

              <button
                id="btn-hero-connect-folder"
                onClick={onConnectDirectory}
                className="flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition border border-slate-200 cursor-pointer"
                title="컴퓨터 또는 사내 네트워크의 공용 폴더를 선택합니다."
              >
                <FolderOpen className="w-4 h-4 text-blue-600" />
                <span>공용 폴더 지정/연결</span>
              </button>

              <button
                id="btn-hero-goto-data"
                onClick={onGoToDataSheet}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <span>DATA 시트 보기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Connected Folder Details Bar */}
          <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-400 font-medium block text-[11px]">연동된 공용폴더 경로</span>
              {isEditingPath ? (
                <div className="flex items-center space-x-1.5 mt-1">
                  <input
                    type="text"
                    value={inputPath}
                    onChange={(e) => setInputPath(e.target.value)}
                    placeholder="예: Z:\경영지원\수주관리 또는 C:\공용폴더"
                    className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSavePath}
                    className="px-2.5 py-1 bg-blue-600 text-white rounded font-semibold text-[11px]"
                  >
                    저장
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="font-mono font-semibold text-slate-800 truncate" title={sharedFolderInfo.path}>
                    {sharedFolderInfo.path || 'C:\\사내공용문서\\수주관리'}
                  </span>
                  <button
                    onClick={() => setIsEditingPath(true)}
                    className="text-[10px] text-blue-600 hover:underline shrink-0"
                  >
                    (수정)
                  </button>
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 font-medium block text-[11px]">최근 원본 동기화 일시</span>
              <div className="flex items-center space-x-1.5 mt-0.5 text-slate-700">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium">{sharedFolderInfo.lastSyncTime || '방금 전 동기화됨'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-medium block text-[11px]">공용폴더 원본 3종 자동 매칭 상태</span>
              <div className="flex items-center space-x-2 mt-0.5">
                {trainingsCount > 0 ? (
                  <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>3종 원본 연동 완료</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 text-slate-500 font-semibold">
                    <span>데이터 대기 중 (공용폴더 연결 또는 파일 업로드 필요)</span>
                  </span>
                )}
                <span className="text-slate-400">|</span>
                <span className="text-slate-600">총 {trainingsCount}건 데이터 매핑 중</span>
              </div>
            </div>
          </div>

          {/* 3 Core Files Live Status Grid */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. 훈련내역 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white/90 shadow-2xs flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">1. 훈련내역 원본</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                    {trainingsCount}행
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono truncate mt-0.5">
                  {sharedFolderInfo.detectedFiles.trainingFile?.name || (trainingsCount > 0 ? '훈련내역_202608.xlsx' : '연동 대기')}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>수정: {formatModifiedTime(sharedFolderInfo.detectedFiles.trainingFile?.lastModified)}</span>
                  <span>{sharedFolderInfo.detectedFiles.trainingFile?.size ? formatFileSize(sharedFolderInfo.detectedFiles.trainingFile.size) : '-'}</span>
                </div>
              </div>
            </div>

            {/* 2. 계산서발행내역 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white/90 shadow-2xs flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">2. 계산서발행내역</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                    {invoicesCount}건
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono truncate mt-0.5">
                  {sharedFolderInfo.detectedFiles.invoiceFile?.name || (invoicesCount > 0 ? '계산서발행내역_08.xlsx' : '연동 대기')}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>수정: {formatModifiedTime(sharedFolderInfo.detectedFiles.invoiceFile?.lastModified)}</span>
                  <span>{sharedFolderInfo.detectedFiles.invoiceFile?.size ? formatFileSize(sharedFolderInfo.detectedFiles.invoiceFile.size) : '-'}</span>
                </div>
              </div>
            </div>

            {/* 3. 입금내역 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white/90 shadow-2xs flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">3. 입금내역 (통장)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">
                    {depositsCount}건
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono truncate mt-0.5">
                  {sharedFolderInfo.detectedFiles.depositFile?.name || (depositsCount > 0 ? '통장거래내역_08.xlsx' : '연동 대기')}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>수정: {formatModifiedTime(sharedFolderInfo.detectedFiles.depositFile?.lastModified)}</span>
                  <span>{sharedFolderInfo.detectedFiles.depositFile?.size ? formatFileSize(sharedFolderInfo.detectedFiles.depositFile.size) : '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 메모리 로드 현황 및 매핑 상태 그리드 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>현재 공용폴더에서 로드된 5대 시트별 데이터 현황</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-blue-50 text-blue-700 border border-blue-200" title="브라우저를 새로고침하거나 닫았다가 다시 열어도 데이터와 비용신청 체크박스 상태가 영구 보존됩니다.">
              💾 영구 저장 활성화됨
            </span>
          </div>

          {onClearAllData && (
            <button
              id="btn-clear-stored-data"
              onClick={onClearAllData}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-lg transition border border-rose-200 shadow-2xs"
              title="저장된 훈련내역, 계산서, 입금내역 및 사전 데이터를 관리/초기화합니다."
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>저장 데이터 초기화</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">1. 훈련내역 (기준)</span>
              <FileSpreadsheet className="w-4 h-4 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{trainingsCount} <span className="text-xs font-normal text-slate-500">행</span></p>
            <p className="text-[11px] text-slate-400 mt-1">사업장명, 과정명, 훈련비총액</p>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">2. 거래처매핑 사전</span>
              <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{companyMappingsCount} <span className="text-xs font-normal text-slate-500">개</span></p>
            <p className="text-[11px] text-slate-400 mt-1">사업장명 ➡️ 거래처코드 매칭</p>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">3. 입금자매핑 사전</span>
              <FileSpreadsheet className="w-4 h-4 text-purple-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{depositorMappingsCount} <span className="text-xs font-normal text-slate-500">개</span></p>
            <p className="text-[11px] text-slate-400 mt-1">입금자명/적요 ➡️ 거래처코드</p>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">4. 계산서발행내역</span>
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{invoicesCount} <span className="text-xs font-normal text-slate-500">건</span></p>
            <p className="text-[11px] text-slate-400 mt-1">발행일자, 세금계산서 정보</p>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">5. 입금내역 (통장)</span>
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{depositsCount} <span className="text-xs font-normal text-slate-500">건</span></p>
            <p className="text-[11px] text-slate-400 mt-1">거래일자, 입금액, 적요</p>
          </div>
        </div>
      </div>

      {/* 3. 업무 프로세스 설명 카드 */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm">
        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
          <Sparkles className="w-4 h-4" />
          <span>공용폴더 파일 업데이트 & 원클릭 새로고침 표준 업무 루틴</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
            <span className="font-bold text-white block mb-1.5 flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
              <span>공용폴더에 최신 엑셀 원본 저장</span>
            </span>
            매월 다운로드받는 <strong>훈련내역, 계산서발행내역, 입금내역</strong> 원본 엑셀 파일을 사내 공용폴더(예: <code>Z:\경영지원\수주관리</code>)에 덮어쓰거나 저장합니다.
          </div>
          <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
            <span className="font-bold text-white block mb-1.5 flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
              <span>[공용폴더 원본 새로고침] 원클릭</span>
            </span>
            프로그램 화면 상단이나 이 화면에서 <strong>[🔄 공용폴더 원본 새로고침]</strong> 버튼을 누르면 수정 시간이 가장 최신인 파일들을 자동 스캔하여 DATA 시트에 반영합니다.
          </div>
          <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
            <span className="font-bold text-white block mb-1.5 flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
              <span>예외 검토 및 DATA 엑셀 저장</span>
            </span>
            <strong>부분입금 확인필요</strong>나 <strong>합산입금 확인필요</strong> 항목을 검토한 후, <strong>[최종 DATA 엑셀 저장]</strong> 버튼으로 보고서를 완성합니다.
          </div>
        </div>
      </div>
    </div>
  );
};
