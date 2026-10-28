import React, { useState } from 'react';
import { Terminal, Copy, Check, Download, ExternalLink, Sparkles, FolderPlus, Play, FileCode2, CheckCircle2 } from 'lucide-react';
import { STREAMLIT_APP_CODE } from '../utils/streamlitCode';

export const StreamlitGuideView: React.FC = () => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPip, setCopiedPip] = useState(false);
  const [copiedRun, setCopiedRun] = useState(false);
  const [copiedBat, setCopiedBat] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(STREAMLIT_APP_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadAppPy = () => {
    const blob = new Blob([STREAMLIT_APP_CODE], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const batContent = `@echo off
chcp 65001 >nul
title 수주 및 비용 통합 관리 시스템 - 로컬 설치 및 자동 실행기
color 0B

echo ==============================================================================
echo   [수주 및 비용 통합 관리 시스템] 로컬 원클릭 설치 및 실행기
echo   - 파이썬(Python) 환경 확인, 필수 라이브러리 자동 설치 후 즉시 실행합니다.
echo ==============================================================================
echo.

:: 1. 파이썬 설치 여부 확인
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [오류] 컴퓨터에 파이썬(Python)이 설치되어 있지 않거나 환경변수(PATH)에 등록되지 않았습니다!
    echo.
    echo 1. https://www.python.org/downloads/ 에서 파이썬을 다운로드하여 설치해주세요.
    echo 2. 설치 창 맨 아래 'Add Python.exe to PATH' 체크박스를 반드시 체크해주세요.
    echo.
    echo 아무 키나 누르면 파이썬 공식 다운로드 페이지가 열립니다...
    pause >nul
    start https://www.python.org/downloads/
    exit /b
)

echo [1/3] 파이썬 환경이 정상 확인되었습니다.
python --version
echo.

:: 2. 필수 라이브러리 자동 설치
echo [2/3] 필수 패키지(Streamlit, Pandas, Openpyxl) 설치 상태를 확인 및 자동 업데이트합니다...
pip install --upgrade pip >nul 2>&1
pip install streamlit pandas openpyxl numpy
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [경고] 패키지 설치 중 일부 경고가 발생했을 수 있으나 계속 진행합니다.
)
echo.

:: 3. app.py 파일 존재 여부 확인
if not exist "app.py" (
    echo [오류] 현재 폴더에 'app.py' 파일이 없습니다!
    echo 다운로드받은 'app.py' 파일을 이 배치파일(%~nx0)과 같은 폴더에 넣어주세요.
    echo.
    pause
    exit /b
)

:: 4. 웹 브라우저 로컬 앱 자동 실행
echo ==============================================================================
echo [3/3] 수주 및 비용 통합 관리 로컬 웹앱을 실행합니다!
echo 잠시 후 기본 웹 브라우저(크롬, 엣지 등)가 자동으로 열립니다...
echo (프로그램을 종료하려면 이 검은색 명령창을 닫으시면 됩니다.)
echo ==============================================================================
echo.

streamlit run app.py

pause`;

  const handleDownloadBat = () => {
    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'run_app.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Intro Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-md border border-slate-700">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Terminal className="w-5 h-5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            비개발자를 위한 사내 로컬 PC 파이썬(Streamlit) 완벽 실행 가이드
          </h2>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed max-w-3xl">
          인터넷 연결이 제한된 사내 PC에서도 파이썬을 이용해 안전하게 웹 브라우저에서 동일한 통합 관리 화면을 띄울 수 있습니다.
          아래 1단계부터 4단계까지 차례대로 따라 하시면 5분 안에 로컬 웹앱이 완성됩니다.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadAppPy}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>app.py 코드 파일 다운로드</span>
          </button>

          <button
            onClick={handleCopyCode}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>전체 파이썬 코드 복사하기</span>
          </button>

          <button
            onClick={handleDownloadBat}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
            title="더블클릭 실행용 윈도우 배치 파일"
          >
            <Sparkles className="w-4 h-4" />
            <span>원클릭 실행용 .bat 파일 다운로드</span>
          </button>
        </div>
      </div>

      {/* Step by Step Manual Cards */}
      <div className="space-y-5">
        {/* 1단계 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
              1
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900">파이썬(Python) 다운로드 및 설치</h3>
              <p className="text-xs text-slate-500 mt-1">
                사내 PC에 아직 파이썬이 설치되어 있지 않다면 파이썬 공식 사이트에서 설치 프로그램을 다운로드합니다.
              </p>

              <div className="mt-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <p className="font-semibold text-slate-800">
                  🌐 공식 다운로드 링크:{' '}
                  <a
                    href="https://www.python.org/downloads/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline font-mono"
                  >
                    https://www.python.org/downloads/
                  </a>
                </p>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900">
                  <strong className="text-amber-950 font-bold block mb-1">⚠️ 설치 시 가장 중요한 필수 체크사항!</strong>
                  파이썬 설치 창이 떴을 때, 맨 아래에 있는 <span className="bg-amber-200 px-1 py-0.5 rounded font-mono font-bold">☑️ Add Python.exe to PATH</span> 체크박스에 <strong>반드시 체크</strong>한 후 [Install Now]를 클릭하세요. (이 체크를 해야 명령창에서 파이썬이 인식됩니다.)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2단계 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
              2
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900">작업 폴더 만들기 및 app.py 파일 넣기</h3>
              <p className="text-xs text-slate-500 mt-1">
                작업할 폴더를 하나 만들고, 상단에서 다운로드한 <code className="text-blue-600 font-bold">app.py</code> 파일을 해당 폴더 안에 복사해 넣습니다.
              </p>

              <div className="mt-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <p className="text-slate-700">
                  예를 들어, <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono">C:\수주관리</code> 또는 바탕화면에 <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono">수주비용관리</code> 폴더를 만듭니다.
                </p>
                <p className="text-slate-600">
                  폴더 안의 구조:{' '}
                  <span className="font-mono text-blue-700 font-semibold">
                    C:\수주비용관리\app.py
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3단계 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
              3
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900">필수 패키지(Streamlit, Pandas, Openpyxl) 1회 설치</h3>
              <p className="text-xs text-slate-500 mt-1">
                명령 프롬프트(CMD) 또는 터미널을 열고 아래 명령어를 복사하여 붙여넣고 엔터를 칩니다.
              </p>

              <div className="mt-3 bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-xs flex items-center justify-between">
                <code>pip install streamlit pandas openpyxl</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('pip install streamlit pandas openpyxl');
                    setCopiedPip(true);
                    setTimeout(() => setCopiedPip(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white flex items-center space-x-1"
                >
                  {copiedPip ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>복사</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                💡 <span className="text-slate-600 font-semibold">Tip:</span> 윈도우 키 누르고 <code>cmd</code>를 입력하면 명령 프롬프트가 열립니다.
              </p>
            </div>
          </div>
        </div>

        {/* 4단계 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
              4
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900">웹앱 실행하기 (브라우저 자동 실행)</h3>
              <p className="text-xs text-slate-500 mt-1">
                <code>app.py</code>가 있는 폴더에서 명령 프롬프트를 열고 아래 명령어를 입력하면 크롬/엣지 브라우저에서 즉시 실행됩니다.
              </p>

              <div className="mt-3 bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-xs flex items-center justify-between">
                <code>streamlit run app.py</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('streamlit run app.py');
                    setCopiedRun(true);
                    setTimeout(() => setCopiedRun(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white flex items-center space-x-1"
                >
                  {copiedRun ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>복사</span>
                </button>
              </div>

              {/* Bonus Bat script tip */}
              <div className="mt-4 p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs space-y-2">
                <div className="flex items-center space-x-1.5 text-indigo-950 font-bold">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>💡 실무 꿀팁: 매번 명령어를 치지 않고 더블클릭으로 바로 켜기</span>
                </div>
                <p className="text-indigo-900">
                  위에서 제공한 <code className="bg-indigo-100 px-1 py-0.5 rounded font-bold">run_app.bat</code> 파일을 <code>app.py</code>와 같은 폴더에 넣어두면, 다음부터는 이 배치 파일만 더블클릭해도 자동으로 웹앱이 켜집니다!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 5단계: 공용폴더 연동 & 새로고침 실무 활용법 */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
              5
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">사내 공용폴더 원본 업데이트 & 원클릭 새로고침 업무 루틴</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                  업무 효율 극대화
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                팀원들이 매월 다운로드받는 원본 엑셀 파일을 공용폴더에 덮어쓰기만 하면 누구나 버튼 한 번으로 최신 현황을 볼 수 있습니다.
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
                  <span className="font-bold text-blue-900 block mb-1">📁 1. 공용폴더에 원본 파일 저장</span>
                  <span className="text-slate-600">
                    사내 공유 드라이브(예: <code>Z:\경영지원\수주관리</code>)에 <strong>훈련내역_08.xlsx</strong>, <strong>계산서_08.xlsx</strong>, <strong>입금내역_08.xlsx</strong>를 저장합니다.
                  </span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
                  <span className="font-bold text-blue-900 block mb-1">🔄 2. [공용폴더 원본 새로고침] 클릭</span>
                  <span className="text-slate-600">
                    웹앱 사이드바의 <strong>[🔄 공용폴더 원본 새로고침]</strong> 버튼을 누르면 파이썬이 수정 시간이 가장 최신인 파일들을 자동 감지하여 DATA 시트로 매핑합니다.
                  </span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
                  <span className="font-bold text-blue-900 block mb-1">📥 3. 예외 검토 및 엑셀 다운로드</span>
                  <span className="text-slate-600">
                    <strong>부분입금 / 합산입금</strong> 필터를 눌러 확인이 필요한 항목만 점검한 뒤 <strong>[최종 DATA 엑셀 저장]</strong>으로 보고서를 완성합니다.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code Viewer Section */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCode2 className="w-4 h-4 text-blue-400" />
            <span className="font-mono text-xs font-bold text-slate-200">app.py 전체 소스코드</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white rounded-lg transition"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? '복사 완료!' : '코드 복사'}</span>
            </button>
            <button
              onClick={handleDownloadAppPy}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>파일 저장</span>
            </button>
          </div>
        </div>

        <div className="p-4 max-h-[480px] overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin text-slate-300">
          <pre>{STREAMLIT_APP_CODE}</pre>
        </div>
      </div>
    </div>
  );
};
