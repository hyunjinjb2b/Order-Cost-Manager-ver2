export const STREAMLIT_APP_CODE = `# ==============================================================================
# 수주 및 비용 통합 관리 프로그램 (app.py)
# - 사내 공용폴더 원본 엑셀 자동 동기화 & 실시간 새로고침 지원
# - 훈련내역, 계산서발행내역, 입금내역, 거래처/입금자 사전 자동 매핑 및 예외 감지
# ==============================================================================

import streamlit as st
import pandas as pd
import numpy as np
from io import BytesIO
import datetime
import os
import glob
import re

# ------------------------------------------------------------------------------
# 1. 페이지 기본 설정 및 스타일 정의
# ------------------------------------------------------------------------------
st.set_page_config(
    page_title="수주 및 비용 통합 관리 시스템",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 사용자 친화적인 커스텀 스타일
st.markdown("""
<style>
    .main-header {
        font-size: 1.8rem;
        font-weight: 700;
        color: #1E293B;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 0.95rem;
        color: #64748B;
        margin-bottom: 1.2rem;
    }
    .sync-card {
        background-color: #F0FDF4;
        border: 1px solid #BBF7D0;
        border-radius: 10px;
        padding: 12px 18px;
        margin-bottom: 15px;
    }
</style>
""", unsafe_allow_html=True)


# ------------------------------------------------------------------------------
# 2. 텍스트 정규화 및 날짜 포맷 유틸리티 함수
# ------------------------------------------------------------------------------
def normalize_name(text):
    """
    회사명, 입금자명의 공백 및 법인 표기((주), (유), 주식회사 등)를 제거하여
    매핑 성공률을 높여주는 정규화 함수
    """
    if pd.isna(text) or text is None:
        return ""
    text = str(text).strip()
    cleaned = re.sub(r'㈜|\(주\)|\(유\)|\(자\)|주식회사|유한회사|합자회사|\s+', '', text)
    return cleaned.lower()


def format_date_str(val):
    if pd.isna(val) or val is None or str(val).strip() in ['', 'nan', 'None']:
        return ""
    s = str(val).strip()
    # 2026-08-01 -> 2026.08.01
    if re.match(r'^\d{4}-\d{2}-\d{2}', s):
        return s[:10].replace('-', '.')
    if re.match(r'^\d{8}$', s):
        return f"{s[:4]}.{s[4:6]}.{s[6:8]}"
    return s


def format_month_str(val):
    if pd.isna(val) or val is None or str(val).strip() in ['', 'nan', 'None']:
        return "08월"
    s = str(val).strip()
    m_match = re.match(r'^(\d{1,2})월?$', s)
    if m_match:
        return f"{int(m_match.group(1)):02d}월"
    return s


# ------------------------------------------------------------------------------
# 3. 핵심 자동 매핑 및 특수 예외 처리 엔진
# ------------------------------------------------------------------------------
def process_data_mapping(df_training, df_company_map, df_depositor_map, df_invoice, df_deposit):
    """
    [핵심 매핑 순서 및 규칙]
    1. 1차 매핑 (계산서): 훈련실시사업장명 -> 거래처매핑 -> 거래처코드 / 사업자번호 / 상호명 -> 계산서발행내역 -> 계산서발행일자
    2. 2차 매핑 (입금): 적요/입금자명 -> 입금자매핑 / 거래처매핑 -> 거래처코드 -> 통장입금액 1:1 대조 -> 수금일자
    3. 특수 예외 처리:
       - 훈련비총액 3단 정밀 대조: 개별 과정별 훈련비총액과 일치하는 계산서 및 입금건 우선 연결
       - 부분 입금: 입금액 미달 혹은 다중 분할 입금 시 '비고'에 "부분입금 확인필요", 수금일자에 누적 날짜 표기
       - 합산 입금: 동일 거래처가 같은 청구월에 여러 과정 수강 시 '비고'에 "합산입금 확인필요"
       - 미매핑 건 알림: 거래처코드 미매핑, 계산서 미발행/미매칭, 입금 미확인
    """
    # 1. 거래처 매핑 사전 구축
    company_to_code = {}
    norm_company_to_code = {}
    biz_to_code = {}
    code_to_biz = {}
    code_to_acc = {}

    if df_company_map is not None and not df_company_map.empty:
        for _, row in df_company_map.iterrows():
            c_name = str(row.get('훈련실시사업장명', row.get('사업장명', row.get('회사명', '')))).strip()
            c_code = str(row.get('거래처코드', '')).strip()
            acc_name = str(row.get('회계거래처명', c_name)).strip()
            biz_num = re.sub(r'[^0-9]', '', str(row.get('사업자번호', row.get('사업자등록번호', ''))))

            if c_code:
                if c_name:
                    company_to_code[c_name] = c_code
                    norm_company_to_code[normalize_name(c_name)] = c_code
                if acc_name:
                    company_to_code[acc_name] = c_code
                    norm_company_to_code[normalize_name(acc_name)] = c_code
                if biz_num:
                    biz_to_code[biz_num] = c_code
                    code_to_biz[c_code] = biz_num
                code_to_acc[c_code] = acc_name

    # 2. 입금자 매핑 사전 구축
    depositor_to_code = {}
    norm_depositor_to_code = {}
    if df_depositor_map is not None and not df_depositor_map.empty:
        for _, row in df_depositor_map.iterrows():
            dep_name = str(row.get('입금자명/적요', row.get('적요/입금자명', row.get('입금자명', '')))).strip()
            c_code = str(row.get('거래처코드', '')).strip()
            if dep_name and c_code:
                depositor_to_code[dep_name] = c_code
                norm_depositor_to_code[normalize_name(dep_name)] = c_code

    # 3. 계산서 발행내역 보강 및 정리 (코드 복원, 사업자번호, 상호명)
    invoices_list = []
    if df_invoice is not None and not df_invoice.empty:
        for _, row in df_invoice.iterrows():
            raw_cust = str(row.get('거래처명', row.get('공급받는자 상호', row.get('상호', '')))).strip()
            norm_cust = normalize_name(raw_cust)
            raw_biz = re.sub(r'[^0-9]', '', str(row.get('사업자번호', row.get('공급받는자 사업자등록번호', ''))))
            c_code = str(row.get('거래처코드', row.get('공급받는자 거래처코드', ''))).strip()

            # 코드 자동 복원
            if not c_code:
                if raw_biz and raw_biz in biz_to_code:
                    c_code = biz_to_code[raw_biz]
                elif raw_cust and raw_cust in company_to_code:
                    c_code = company_to_code[raw_cust]
                elif norm_cust and norm_cust in norm_company_to_code:
                    c_code = norm_company_to_code[norm_cust]

            issue_date = format_date_str(row.get('발행일', row.get('발행일자', row.get('작성일자', ''))))
            try:
                tot_amt = float(str(row.get('합계', row.get('합계금액', row.get('총액', 0)))).replace(',', ''))
            except (ValueError, TypeError):
                tot_amt = 0.0
            try:
                sup_amt = float(str(row.get('공급가액', row.get('공급가', 0)))).replace(',', '')
            except (ValueError, TypeError):
                sup_amt = tot_amt
            if tot_amt == 0.0 and sup_amt > 0.0:
                tot_amt = sup_amt

            summary = str(row.get('적요/품목', row.get('적요', row.get('품목', '')))).strip()

            invoices_list.append({
                'c_code': c_code,
                'raw_cust': raw_cust,
                'norm_cust': norm_cust,
                'biz_num': raw_biz,
                'date': issue_date,
                'total': tot_amt,
                'supply': sup_amt,
                'summary': summary,
                'used': False
            })

    # 4. 입금내역 보강 및 정리
    deposits_list = []
    if df_deposit is not None and not df_deposit.empty:
        for _, row in df_deposit.iterrows():
            raw_dep_name = str(row.get('적요/입금자명', row.get('적요', row.get('입금자명', '')))).strip()
            norm_dep = normalize_name(raw_dep_name)
            deal_date = format_date_str(row.get('거래일자', row.get('일자', row.get('입금일자', ''))))
            amount_val = row.get('입금액', row.get('금액', 0))

            try:
                amount = float(str(amount_val).replace(',', ''))
            except (ValueError, TypeError):
                amount = 0.0

            matched_code = depositor_to_code.get(raw_dep_name) or norm_depositor_to_code.get(norm_dep)
            if not matched_code:
                matched_code = company_to_code.get(raw_dep_name) or norm_company_to_code.get(norm_dep)
            if not matched_code:
                for comp_norm, c_c in norm_company_to_code.items():
                    if comp_norm and (comp_norm in norm_dep or norm_dep in comp_norm):
                        matched_code = c_c
                        break

            deposits_list.append({
                'c_code': matched_code or '',
                'raw_name': raw_dep_name,
                'norm_name': norm_dep,
                'date': deal_date,
                'amount': amount,
                'used': False
            })

    # 5. 훈련내역을 거래처별로 그룹화하여 '훈련비총액' 기준 정밀 대조 매핑
    output_rows = []
    if df_training is not None and not df_training.empty:
        groups = {}
        for idx, row in df_training.iterrows():
            comp_name = str(row.get('훈련실시사업장명', row.get('사업장명', row.get('회사명', '')))).strip()
            norm_comp = normalize_name(comp_name)
            customer_code = company_to_code.get(comp_name) or norm_company_to_code.get(norm_comp) or ''
            if not customer_code:
                for comp_norm, c_c in norm_company_to_code.items():
                    if comp_norm and (comp_norm in norm_comp or norm_comp in comp_norm):
                        customer_code = c_c
                        break

            g_key = customer_code if customer_code else f"NAME_{norm_comp or comp_name}"
            if g_key not in groups:
                groups[g_key] = {
                    'customer_code': customer_code,
                    'comp_name': comp_name,
                    'norm_comp': norm_comp,
                    'items': []
                }
            groups[g_key]['items'].append((idx, row))

        for g_key, g_info in groups.items():
            customer_code = g_info['customer_code']
            comp_name = g_info['comp_name']
            norm_comp = g_info['norm_comp']
            items = g_info['items']
            biz_num = code_to_biz.get(customer_code, '')
            acc_name = code_to_acc.get(customer_code, comp_name)
            norm_acc = normalize_name(acc_name)

            # 후보 계산서 필터링
            group_invoices = []
            for inv in invoices_list:
                is_m = False
                if customer_code and inv['c_code'] == customer_code:
                    is_m = True
                elif biz_num and inv['biz_num'] and biz_num == inv['biz_num']:
                    is_m = True
                elif norm_comp and inv['norm_cust'] and (norm_comp == inv['norm_cust'] or norm_acc == inv['norm_cust']):
                    is_m = True
                elif len(norm_comp) >= 2 and len(inv['norm_cust']) >= 2 and (norm_comp in inv['norm_cust'] or inv['norm_cust'] in norm_comp):
                    is_m = True
                
                if is_m:
                    group_invoices.append(inv)

            # 후보 입금 필터링
            group_deposits = []
            for dep in deposits_list:
                is_m = False
                if customer_code and dep['c_code'] == customer_code:
                    is_m = True
                elif norm_comp and dep['norm_name'] and (norm_comp == dep['norm_name'] or norm_acc == dep['norm_name']):
                    is_m = True
                elif len(norm_comp) >= 2 and len(dep['norm_name']) >= 2 and (norm_comp in dep['norm_name'] or dep['norm_name'] in norm_comp):
                    is_m = True

                if is_m:
                    group_deposits.append(dep)

            group_results = {}

            # Step 1: 계산서 1차 매칭 (훈련비총액 우선 대조)
            for idx, row in items:
                try:
                    tr_cost = float(str(row.get('훈련비총액', row.get('총액', 0))).replace(',', ''))
                except:
                    tr_cost = 0.0
                course_name = str(row.get('과정명', '')).strip()

                matched_inv_date = ""
                for inv in group_invoices:
                    if not inv['used'] and (abs(inv['total'] - tr_cost) < 1 or abs(inv['supply'] - tr_cost) < 1):
                        inv['used'] = True
                        matched_inv_date = inv['date']
                        break
                
                if not matched_inv_date and course_name:
                    for inv in group_invoices:
                        if not inv['used'] and inv['summary'] and (inv['summary'] in course_name or course_name in inv['summary']):
                            inv['used'] = True
                            matched_inv_date = inv['date']
                            break

                group_results[idx] = {
                    'inv_date': matched_inv_date,
                    'dep_date': '',
                    'dep_amt': 0.0,
                    'note': ''
                }

            # 잔여 계산서 순차 배정
            for idx, row in items:
                if not group_results[idx]['inv_date']:
                    for inv in group_invoices:
                        if not inv['used']:
                            inv['used'] = True
                            group_results[idx]['inv_date'] = inv['date']
                            break

            # Step 2: 통장 입금내역 2차 매칭 (훈련비총액 1:1 대조)
            for idx, row in items:
                try:
                    tr_cost = float(str(row.get('훈련비총액', row.get('총액', 0))).replace(',', ''))
                except:
                    tr_cost = 0.0

                for dep in group_deposits:
                    if not dep['used'] and abs(dep['amount'] - tr_cost) < 1:
                        dep['used'] = True
                        group_results[idx]['dep_date'] = dep['date']
                        group_results[idx]['dep_amt'] = dep['amount']
                        if group_results[idx]['inv_date']:
                            group_results[idx]['note'] = ''
                        break

            # 합산입금 감지
            unmatched_indices = [idx for idx, _ in items if not group_results[idx]['dep_date']]
            if len(unmatched_indices) > 1:
                unmatched_sum = 0.0
                for idx in unmatched_indices:
                    r = df_training.loc[idx]
                    try:
                        unmatched_sum += float(str(r.get('훈련비총액', r.get('총액', 0))).replace(',', ''))
                    except:
                        pass
                for dep in group_deposits:
                    if not dep['used'] and abs(dep['amount'] - unmatched_sum) < 1:
                        dep['used'] = True
                        for idx in unmatched_indices:
                            group_results[idx]['dep_date'] = dep['date']
                            group_results[idx]['dep_amt'] = float(str(df_training.loc[idx].get('훈련비총액', 0)).replace(',', ''))
                            group_results[idx]['note'] = '합산입금 확인필요'
                        break

            # 잔여 입금 및 부분입금/미입금 처리
            still_unmatched = [idx for idx, _ in items if not group_results[idx]['dep_date']]
            unused_deps = [d for d in group_deposits if not d['used']]

            if len(still_unmatched) == 1 and len(unused_deps) > 0:
                s_idx = still_unmatched[0]
                try:
                    s_cost = float(str(df_training.loc[s_idx].get('훈련비총액', 0)).replace(',', ''))
                except:
                    s_cost = 0.0
                d_dates = sorted(list(set([d['date'] for d in unused_deps if d['date']])))
                d_sum = sum([d['amount'] for d in unused_deps])
                for d in unused_deps:
                    d['used'] = True
                group_results[s_idx]['dep_date'] = ", ".join(d_dates)
                group_results[s_idx]['dep_amt'] = d_sum
                if d_sum < s_cost and d_sum > 0:
                    group_results[s_idx]['note'] = '부분입금 확인필요'
                elif len(d_dates) > 1:
                    group_results[s_idx]['note'] = '부분입금 확인필요'
                else:
                    group_results[s_idx]['note'] = ''
            elif len(still_unmatched) > 1 and len(unused_deps) > 0:
                d_dates = sorted(list(set([d['date'] for d in unused_deps if d['date']])))
                d_sum = sum([d['amount'] for d in unused_deps])
                for d in unused_deps:
                    d['used'] = True
                for idx in still_unmatched:
                    group_results[idx]['dep_date'] = ", ".join(d_dates)
                    group_results[idx]['dep_amt'] = d_sum
                    group_results[idx]['note'] = '합산입금 확인필요'

            # 최종 비고 판정
            for idx, row in items:
                res = group_results[idx]
                if not customer_code:
                    res['note'] = '거래처코드 미매핑'
                elif not res['inv_date']:
                    res['note'] = '계산서 미발행/미매칭'
                elif not res['dep_date'] or res['dep_amt'] == 0:
                    res['note'] = '입금 미확인'

                claim_month = format_month_str(row.get('청구월', '08월'))
                course_name = str(row.get('과정명', '')).strip()
                period = str(row.get('훈련기간', '')).strip()
                hrd_round = row.get('HRD회차', row.get('회차', 1))
                headcount = row.get('실시인원', row.get('인원', 1))
                try:
                    total_cost = float(str(row.get('훈련비총액', row.get('총액', 0))).replace(',', ''))
                except:
                    total_cost = 0.0
                try:
                    gov_subsidy = float(str(row.get('정부지원금', row.get('지원금', 0))).replace(',', ''))
                except:
                    gov_subsidy = 0.0

                # 비용신청여부 (기본 전체 OFF)
                expense_applied = False

                refund_date = format_date_str(row.get('환급일자', ''))

                output_rows.append({
                    '청구월': claim_month,
                    '거래처코드': customer_code,
                    '훈련실시사업장명': comp_name,
                    '과정명': course_name,
                    '훈련기간': period,
                    'HRD회차': hrd_round,
                    '실시인원': headcount,
                    '훈련비총액': total_cost,
                    '정부지원금': gov_subsidy,
                    '계산서발행일자': res['inv_date'],
                    '수금일자': res['dep_date'],
                    '비용신청여부': expense_applied,
                    '환급일자': refund_date,
                    '비고': res['note']
                })

    return pd.DataFrame(output_rows)


# ------------------------------------------------------------------------------
# 4. 공용폴더 자동 스캔 및 엑셀 로딩 함수
# ------------------------------------------------------------------------------
def load_data_from_shared_folder(folder_path):
    """
    공용폴더(또는 지정 경로)에서 최신 원본 엑셀 파일들을 자동으로 찾아 읽어옵니다.
    1. 통합 엑셀 파일 1개 (여러 시트 포함)
    2. 또는 개별 파일들 (*훈련*.xlsx, *계산서*.xlsx, *입금*.xlsx, *매핑*.xlsx)
    """
    if not os.path.exists(folder_path):
        return None, None, None, None, None, [], f"지정한 폴더를 찾을 수 없습니다: {folder_path}"

    excel_files = glob.glob(os.path.join(folder_path, "*.xlsx")) + glob.glob(os.path.join(folder_path, "*.xls"))
    if not excel_files:
        return None, None, None, None, None, [], f"'{folder_path}' 폴더 안에 엑셀 파일(.xlsx)이 없습니다."

    df_training = None
    df_company_map = None
    df_depositor_map = None
    df_invoice = None
    df_deposit = None
    loaded_files_info = []

    # 최신 수정된 파일 순으로 탐색
    excel_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)

    for file_path in excel_files:
        filename = os.path.basename(file_path)
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d %H:%M:%S')
        clean_fn = filename.lower()

        try:
            xl = pd.ExcelFile(file_path)
            sheets = xl.sheet_names
            detected_any = False

            for s in sheets:
                clean_s = s.strip().lower()
                if ('훈련' in clean_s or 'data' in clean_s) and df_training is None:
                    df_training = pd.read_excel(file_path, sheet_name=s)
                    detected_any = True
                elif '거래처' in clean_s and df_company_map is None:
                    df_company_map = pd.read_excel(file_path, sheet_name=s)
                    detected_any = True
                elif '입금자' in clean_s and df_depositor_map is None:
                    df_depositor_map = pd.read_excel(file_path, sheet_name=s)
                    detected_any = True
                elif ('계산서' in clean_s or '세금' in clean_s) and df_invoice is None:
                    df_invoice = pd.read_excel(file_path, sheet_name=s)
                    detected_any = True
                elif ('입금' in clean_s or '통장' in clean_s) and df_deposit is None:
                    df_deposit = pd.read_excel(file_path, sheet_name=s)
                    detected_any = True

            # 단일 시트 파일 이름 기준 매칭
            if not detected_any and len(sheets) == 1:
                df_single = pd.read_excel(file_path, sheet_name=0)
                if ('훈련' in clean_fn or '수주' in clean_fn) and df_training is None:
                    df_training = df_single
                    detected_any = True
                elif ('계산서' in clean_fn or '세금' in clean_fn) and df_invoice is None:
                    df_invoice = df_single
                    detected_any = True
                elif ('입금' in clean_fn or '통장' in clean_fn) and df_deposit is None:
                    df_deposit = df_single
                    detected_any = True
                elif '거래처' in clean_fn and df_company_map is None:
                    df_company_map = df_single
                    detected_any = True
                elif '입금자' in clean_fn and df_depositor_map is None:
                    df_depositor_map = df_single
                    detected_any = True

            if detected_any:
                loaded_files_info.append(f"{filename} (수정: {mtime})")

        except Exception as e:
            continue

    return df_training, df_company_map, df_depositor_map, df_invoice, df_deposit, loaded_files_info, None


# ------------------------------------------------------------------------------
# 5. 기본 내장 샘플 데이터 (초기 데모 및 테스트용)
# ------------------------------------------------------------------------------
def generate_sample_data():
    df_training = pd.DataFrame([
        {'청구월': '08월', '훈련실시사업장명': '건창정밀', '과정명': '사출금형 직무향상', '훈련기간': '2026-04-22~2026-05-21', 'HRD회차': 1, '실시인원': 2, '훈련비총액': 150000, '정부지원금': 120000, '비용신청여부': True, '환급일자': '2026-08-15'},
        {'청구월': '08월', '훈련실시사업장명': '경은전기(주)', '과정명': '전기설비 유지보수', '훈련기간': '2026-04-22~2026-05-21', 'HRD회차': 1, '실시인원': 3, '훈련비총액': 120000, '정부지원금': 90000, '비용신청여부': False, '환급일자': ''},
        {'청구월': '08월', '훈련실시사업장명': '고려제약', '과정명': 'GMP 공정관리 A', '훈련기간': '2026-04-22~2026-05-21', 'HRD회차': 1, '실시인원': 5, '훈련비총액': 300000, '정부지원금': 250000, '비용신청여부': False, '환급일자': ''},
        {'청구월': '08월', '훈련실시사업장명': '고려제약', '과정명': '품질분석 실무 B', '훈련기간': '2026-04-22~2026-05-21', 'HRD회차': 2, '실시인원': 2, '훈련비총액': 180000, '정부지원금': 150000, '비용신청여부': False, '환급일자': ''},
        {'청구월': '08월', '훈련실시사업장명': '공영화학공업', '과정명': '화학물질 취급안전', '훈련기간': '2026-04-22~2026-05-21', 'HRD회차': 1, '실시인원': 4, '훈련비총액': 250000, '정부지원금': 200000, '비용신청여부': False, '환급일자': ''},
        {'청구월': '08월', '훈련실시사업장명': '광동제약', '과정명': '제약 생산자동화', '훈련기간': '2026-04-22~2026-05-21', 'HRD회차': 1, '실시인원': 6, '훈련비총액': 450000, '정부지원금': 400000, '비용신청여부': False, '환급일자': ''},
        {'청구월': '08월', '훈련실시사업장명': '신규사업장테스트', '과정명': '스마트공장 실무', '훈련기간': '2026-04-22~2026-05-21', 'HRD회차': 1, '실시인원': 1, '훈련비총액': 100000, '정부지원금': 80000, '비용신청여부': False, '환급일자': ''}
    ])

    df_company_map = pd.DataFrame([
        {'훈련실시사업장명': '건창정밀', '거래처코드': '8947038', '회계거래처명': '건창정밀', '사업자번호': '123-45-67890'},
        {'훈련실시사업장명': '경은전기(주)', '거래처코드': '7392014', '회계거래처명': '경은전기', '사업자번호': '234-56-78901'},
        {'훈련실시사업장명': '고려제약', '거래처코드': '5829103', '회계거래처명': '고려제약(주)', '사업자번호': '345-67-89012'},
        {'훈련실시사업장명': '공영화학공업', '거래처코드': '9102834', '회계거래처명': '공영화학', '사업자번호': '456-78-90123'},
        {'훈련실시사업장명': '광동제약', '거래처코드': '6281940', '회계거래처명': '광동제약(주)', '사업자번호': '567-89-01234'}
    ])

    df_depositor_map = pd.DataFrame([
        {'입금자명/적요': '건창정밀', '거래처코드': '8947038', '회계거래처명': '건창정밀'},
        {'입금자명/적요': '경은전기 김대표', '거래처코드': '7392014', '회계거래처명': '경은전기'},
        {'입금자명/적요': '고려제약 훈련비', '거래처코드': '5829103', '회계거래처명': '고려제약(주)'},
        {'입금자명/적요': '공영화학 1차', '거래처코드': '9102834', '회계거래처명': '공영화학'},
        {'입금자명/적요': '공영화학 2차', '거래처코드': '9102834', '회계거래처명': '공영화학'}
    ])

    df_invoice = pd.DataFrame([
        {'발행일': '2026-08-12', '거래처코드': '8947038', '거래처명': '건창정밀', '합계': 150000},
        {'발행일': '2026-08-13', '거래처코드': '7392014', '거래처명': '경은전기', '합계': 120000},
        {'발행일': '2026-08-14', '거래처코드': '5829103', '거래처명': '고려제약(주)', '합계': 480000},
        {'발행일': '2026-08-15', '거래처코드': '9102834', '거래처명': '공영화학', '합계': 250000}
    ])

    df_deposit = pd.DataFrame([
        {'거래일자': '2026-08-18', '입금액': 150000, '적요/입금자명': '건창정밀'},
        {'거래일자': '2026-08-19', '입금액': 120000, '적요/입금자명': '경은전기 김대표'},
        {'거래일자': '2026-08-20', '입금액': 480000, '적요/입금자명': '고려제약 훈련비'},
        {'거래일자': '2026-08-21', '입금액': 100000, '적요/입금자명': '공영화학 1차'},
        {'거래일자': '2026-08-23', '입금액': 150000, '적요/입금자명': '공영화학 2차'}
    ])

    return df_training, df_company_map, df_depositor_map, df_invoice, df_deposit


# ------------------------------------------------------------------------------
# 6. 메인 화면 및 인터페이스
# ------------------------------------------------------------------------------
def main():
    st.markdown('<div class="main-header">수주 및 비용 통합 관리 프로그램 (DATA 자동 매핑)</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">공용폴더의 원본 엑셀을 업데이트하고 새로고침 버튼만 누르면 DATA 시트에 자동 매핑됩니다.</div>', unsafe_allow_html=True)

    # 사이드바 설정 (공용폴더 원본 전용 연동)
    with st.sidebar:
        st.header("📂 사내 공용폴더 연동 설정")
        
        shared_folder_path = st.text_input(
            "공용폴더 경로 지정",
            value="./data",
            help="예: C:/공용폴더/수주관리 또는 Z:/경영지원/수주관리"
        )
        refresh_clicked = st.button("🔄 공용폴더 원본 새로고침", type="primary", use_container_width=True)

        st.markdown("---")
        st.caption("⚙️ **공용폴더 자동 매핑 순서**")
        st.caption("1. 훈련실시사업장명 ➡️ 거래처코드 ➡️ 계산서발행일")
        st.caption("2. 입금자명/적요 ➡️ 거래처코드 ➡️ 수금일자")
        st.caption("3. 부분입금 & 합산입금 자동 감지")
        st.caption("4. 미입금/미발행 내역 비고란 자동 태깅")

    # 공용폴더 데이터 로드 처리
    df_tr, df_cm, df_dm, df_inv, df_dep, loaded_files, err = load_data_from_shared_folder(shared_folder_path)
    if err:
        st.sidebar.warning(f"⚠️ {err}")
        st.sidebar.info("💡 실습용 기본 샘플 데이터로 전환하여 표시합니다.")
        df_training, df_company_map, df_depositor_map, df_invoice, df_deposit = generate_sample_data()
        sync_status_msg = f"공용폴더 연결 대기 중 ({shared_folder_path}) - 샘플 데이터 표시 중"
    else:
        df_training, df_company_map, df_depositor_map, df_invoice, df_deposit = df_tr, df_cm, df_dm, df_inv, df_dep
        if df_training is None:
            df_training, df_company_map, df_depositor_map, df_invoice, df_deposit = generate_sample_data()
            sync_status_msg = f"폴더 내 훈련내역 파일이 없어 기본 샘플로 표시합니다."
        else:
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            sync_status_msg = f"✅ 공용폴더 최신 원본 {len(loaded_files)}건 자동 동기화 완료! (동기화 일시: {now_str})"
            st.sidebar.success(sync_status_msg)

    # 공용폴더 상태 배너
    if loaded_files:
        st.markdown(f"""
        <div class="sync-card">
            <strong>📁 공용폴더 실시간 동기화 상태:</strong> {sync_status_msg}<br/>
            <span style="font-size:12px; color:#15803D;">📑 감지된 파일: {', '.join(loaded_files)}</span>
        </div>
        """, unsafe_allow_html=True)

    # 핵심 매핑 실행
    final_df = process_data_mapping(df_training, df_company_map, df_depositor_map, df_invoice, df_deposit)

    # 상단 요약 통계 카드
    total_count = len(final_df)
    total_revenue = final_df['훈련비총액'].sum()
    total_subsidy = final_df['정부지원금'].sum()
    
    partial_count = len(final_df[final_df['비고'].str.contains('부분입금', na=False)])
    combined_count = len(final_df[final_df['비고'].str.contains('합산입금', na=False)])
    unmapped_count = len(final_df[final_df['비고'].str.contains('미매핑|미발행|미확인', na=False)])

    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        st.metric("총 훈련 건수", f"{total_count:,} 건")
    with col2:
        st.metric("총 훈련비 청구액", f"{int(total_revenue):,} 원")
    with col3:
        st.metric("총 정부지원금", f"{int(total_subsidy):,} 원")
    with col4:
        st.metric("⚠️ 부분/합산 확인필요", f"{partial_count + combined_count} 건")
    with col5:
        st.metric("❌ 미매칭/확인필요", f"{unmapped_count} 건")

    st.markdown("---")

    # 탭 구성: DATA 통합 뷰 / 원본 매핑사전 확인
    tab1, tab2 = st.tabs(["📊 통합 관리 화면 (DATA 시트)", "📖 매핑 사전 및 원본 내역 확인"])

    with tab1:
        # 상단 새로고침 및 필터 바
        c_top1, c_top2 = st.columns([1, 3])
        with c_top1:
            if st.button("🔄 원본 최신 데이터 새로고침", key="main_body_refresh", type="secondary"):
                st.rerun()

        st.subheader("📝 통합 현황 편집 테이블 (DATA 양식)")
        st.caption("💡 셀을 더블클릭하여 내용을 직접 수정할 수 있습니다. 수정 후 아래 다운로드 버튼을 누르면 엑셀로 저장됩니다.")

        # 필터링 옵션
        f_col1, f_col2 = st.columns([1, 2])
        with f_col1:
            note_filter = st.selectbox(
                "상태 필터 선택",
                options=["전체 보기", "확인필요 건만 보기 (부분/합산/미매핑)", "정상 완료 건만 보기"]
            )
        with f_col2:
            search_query = st.text_input("🔍 사업장명 또는 거래처코드 검색", placeholder="예: 건창, 8947038...")

        # 필터 적용
        display_df = final_df.copy()
        if note_filter == "확인필요 건만 보기 (부분/합산/미매핑)":
            display_df = display_df[display_df['비고'] != '']
        elif note_filter == "정상 완료 건만 보기":
            display_df = display_df[display_df['비고'] == '']

        if search_query.strip():
            q = search_query.strip().lower()
            display_df = display_df[
                display_df['훈련실시사업장명'].str.lower().str.contains(q, na=False) |
                display_df['거래처코드'].str.lower().str.contains(q, na=False) |
                display_df['과정명'].str.lower().str.contains(q, na=False)
            ]

        # 데이터 에디터 출력
        edited_df = st.data_editor(
            display_df,
            use_container_width=True,
            num_rows="dynamic",
            column_config={
                "훈련비총액": st.column_config.NumberColumn("훈련비총액", format="%d 원"),
                "정부지원금": st.column_config.NumberColumn("정부지원금", format="%d 원"),
                "비용신청여부": st.column_config.CheckboxColumn("비용신청여부", default=False),
                "비고": st.column_config.TextColumn("비고 (특수 예외)", help="부분입금/합산입금/미매핑 자동 감지"),
                "수금일자": st.column_config.TextColumn("수금일자", help="다중 입금 시 날짜가 누적 표기됩니다.")
            },
            height=450
        )

        # 엑셀 다운로드 버튼
        st.markdown("### 💾 결과 저장 및 내보내기")
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            edited_df.to_excel(writer, sheet_name='DATA', index=False)
            if df_company_map is not None:
                df_company_map.to_excel(writer, sheet_name='거래처매핑', index=False)
            if df_depositor_map is not None:
                df_depositor_map.to_excel(writer, sheet_name='입금자매핑', index=False)
            if df_invoice is not None:
                df_invoice.to_excel(writer, sheet_name='계산서발행내역', index=False)
            if df_deposit is not None:
                df_deposit.to_excel(writer, sheet_name='입금내역', index=False)
        output.seek(0)

        today_str = datetime.datetime.now().strftime("%Y%m%d")
        st.download_button(
            label="📥 수정된 최종 DATA 엑셀 파일 (.xlsx) 다운로드",
            data=output,
            file_name=f"수주비용통합관리_DATA_{today_str}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary"
        )

    with tab2:
        st.subheader("📚 참조 매핑 사전 및 원본 내역")
        sub_tab1, sub_tab2, sub_tab3, sub_tab4 = st.tabs(["🏢 거래처 매핑", "💰 입금자 매핑", "🧾 계산서 발행내역", "💳 입금 내역"])

        with sub_tab1:
            if df_company_map is not None and not df_company_map.empty:
                st.dataframe(df_company_map, use_container_width=True)
            else:
                st.info("등록된 거래처 매핑 데이터가 없습니다.")

        with sub_tab2:
            if df_depositor_map is not None and not df_depositor_map.empty:
                st.dataframe(df_depositor_map, use_container_width=True)
            else:
                st.info("등록된 입금자 매핑 데이터가 없습니다.")

        with sub_tab3:
            if df_invoice is not None and not df_invoice.empty:
                st.dataframe(df_invoice, use_container_width=True)
            else:
                st.info("등록된 계산서 발행내역이 없습니다.")

        with sub_tab4:
            if df_deposit is not None and not df_deposit.empty:
                st.dataframe(df_deposit, use_container_width=True)
            else:
                st.info("등록된 입금 내역이 없습니다.")


if __name__ == '__main__':
    main()
`;
