# Adaptive Inventory Control under Uncertain Demand

**불확실한 수요 환경에서의 적응형 재고 관리 시뮬레이션 웹 데모**

이 프로젝트는 강화학습 기반 재고 관리 시스템을 웹 브라우저에서 체험할 수 있는 시뮬레이션 도구입니다.

---

## 📋 프로젝트 개요

사용자가 리드타임, 창고 용량, 비용 구조, 평일/주말 수요 비율, 수요 불확실성 등을 직접 설정하면, 그 설정에 맞춰 **재고·수요·입고·주문 패턴**을 180일간 시뮬레이션하고 시각화합니다.

### 목적
- RL_project.ipynb에서 정의한 `WarehouseEnv`를 브라우저에서 직관적으로 체험
- 다양한 파라미터가 재고 관리 전략에 미치는 영향 이해
- 수요 불확실성 레벨(Low/Medium/High/Very High)에 따른 재고 전략 변화 관찰
- 향후 RL 정책(DQN)을 쉽게 연동할 수 있는 구조

---

## 🚀 실행 방법

### 1. 로컬에서 직접 열기
```bash
# index.html을 브라우저에서 직접 열기
open index.html  # macOS
start index.html # Windows
```

### 2. 로컬 서버 실행 (권장)
```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve

# 브라우저에서 http://localhost:8000 접속
```

---

## 📁 파일 구조

```
.
├── index.html      # 메인 HTML 페이지 (UI 구조)
├── styles.css      # 스타일시트 (반응형 디자인)
├── app.js          # 시뮬레이션 로직 (Vanilla JS)
├── prd.md          # 제품 요구사항 정의서
└── README.md       # 프로젝트 문서 (이 파일)
```

---

## 🎮 사용 방법

### 1. 환경 설정 (좌측 패널)

#### Lead Time
- **Min/Max Lead Time**: 주문 후 도착까지 걸리는 시간 (일)

#### Warehouse Scale
- **Max Capacity**: 창고 최대 용량
- **Max Daily Demand**: 하루 최대 수요

#### Cost Structure
- **Holding Cost**: 재고 보유 비용 (단위당/일)
- **Stockout Cost**: 품절 패널티 (단위당)
- **Purchase Cost**: 제품 매입 비용 (단위당)
- **Fixed Order Cost**: 주문당 고정 비용

#### Demand Profile
- **Base Weekday Demand**: 평일 평균 수요
- **Weekend / Weekday Ratio**: 주말/평일 수요 비율
  - 1.0 = 주말과 평일 동일
  - 1.5 = 주말 수요가 1.5배
- **Demand Uncertainty Level**: 수요 변동성
  - Low (±10%), Medium (±25%), High (±40%), Very High (±60%)
- **Demand Pattern**: 수요 패턴 유형
  - Stable: 안정적
  - Seasonal: 계절성 (60일 주기)
  - Trending: 증가 추세
  - Volatile: 급변동 (Random Walk)

### 2. 시뮬레이션 실행

1. 파라미터 입력 후 **Run Simulation** 버튼 클릭
2. 180일간 시뮬레이션이 실행됩니다
3. 결과가 그래프와 KPI 카드로 표시됩니다

### 3. 결과 확인

#### 메인 그래프
- **Inventory (7d MA)**: 재고 수준 (7일 이동평균)
- **Demand (7d MA)**: 수요 (7일 이동평균)
- **Avg Incoming (7d MA)**: 평균 입고량 (7일 이동평균)
- **Order Qty (7d MA)**: 주문량 (7일 이동평균)

#### 그래프 필터 기능 ✨
- 체크박스로 원하는 지표만 선택해서 볼 수 있습니다
- Legend 클릭으로도 토글 가능합니다
- 예: "재고 vs 수요"만 비교하고 싶다면 나머지 체크 해제

#### KPI 카드
- **Average Inventory**: 평균 재고 수준
- **Average Demand**: 평균 수요
- **Total Stockout**: 총 품절량
- **Total Cost**: 총 비용

#### 일별 상세 테이블 (옵션)
- **Show Table** 버튼 클릭 시 첫 30일 상세 데이터 확인

---

## 💡 체험 시나리오

### 시나리오 1: 안정적 환경
```
Demand Uncertainty: Low
Demand Pattern: Stable
Weekend Ratio: 1.0
```
→ 예측 가능한 환경에서 재고 관리가 어떻게 작동하는지 확인

### 시나리오 2: 주말 수요 급증
```
Demand Uncertainty: Medium
Demand Pattern: Stable
Weekend Ratio: 2.0
```
→ 주말에 수요가 2배로 증가할 때 재고 패턴 변화 관찰

### 시나리오 3: 극단적 불확실성
```
Demand Uncertainty: Very High
Demand Pattern: Volatile
Weekend Ratio: 1.5
```
→ 예측 불가능한 시장 환경에서의 재고 관리 어려움 체험

### 시나리오 4: 성장하는 시장
```
Demand Uncertainty: Medium
Demand Pattern: Trending
Weekend Ratio: 1.3
```
→ 수요가 점진적으로 증가하는 환경에서의 주문 전략

---

## 🔧 기술 스택

- **HTML5/CSS3**: 구조와 디자인
- **Vanilla JavaScript**: 시뮬레이션 로직
- **Chart.js v4**: 데이터 시각화
- **Flexbox/CSS Grid**: 반응형 레이아웃

---

## 📊 시뮬레이션 로직

### 주문 정책 (현재: Heuristic)
```javascript
// 목표 재고 = 7일치 수요
targetInventory = prevDemand * 7

// 현재 재고 + 파이프라인을 고려해 부족분 주문
orderQty = targetInventory - (inventory + totalIncoming)
```

### 수요 생성
1. **요일 효과**: 평일 vs 주말 (weekendRatio 적용)
2. **패턴 효과**: Stable/Seasonal/Trending/Volatile
3. **불확실성**: 정규분포 노이즈 (demandVariance)
4. **수요 쇼크**: 갑작스런 급증/급감 (demandShockProb)

### 비용 계산 (RL_project.ipynb와 동일)
```javascript
holdingCost = inventory * HOLDING_COST
stockoutCost = stockout * STOCKOUT_COST
variableOrderCost = orderQty * PURCHASE_COST
fixedOrderCost = (orderQty > 0) ? FIXED_ORDER_COST : 0

totalCost = holdingCost + stockoutCost + variableOrderCost + fixedOrderCost
reward = -totalCost / 100000  // Scaled for RL
```

---

## 🔮 향후 확장 계획

### Phase 1 (완료)
- ✅ 기본 시뮬레이션 환경
- ✅ 수요 불확실성 조절
- ✅ 그래프 필터 UI
- ✅ 반응형 디자인

### Phase 2 (계획)
- [ ] RL 정책(DQN) 연동
  - Python 서버 / API 연결
  - Heuristic vs RL 성능 비교
- [ ] 정책 선택 드롭다운
  - Target Inventory Policy (현재)
  - (s,S) Policy
  - DQN Policy (학습된 모델)
- [ ] 여러 시뮬레이션 결과 동시 비교

### Phase 3 (미래)
- [ ] Training Curve 탭 추가
- [ ] CSV 데이터 업로드 기능
- [ ] 하이퍼파라미터 실시간 조정
- [ ] 시뮬레이션 결과 다운로드 (CSV/JSON)

---

## 📚 참고 문서

- **PRD (제품 요구사항 정의서)**: `prd.md`
- **RL Project Notebook**: `RL_project.ipynb` (연동 예정)
- **Chart.js 공식 문서**: https://www.chartjs.org/

---

## 🎓 교육 활용

이 도구는 다음 용도로 활용할 수 있습니다:
- 강화학습 강의/프로젝트 발표 데모
- 재고 관리 개념 교육 자료
- 수요 불확실성 영향 분석 실습
- RL 정책 성능 시각화 및 비교

---

## 📝 라이선스

본 프로젝트는 교육 목적으로 제작되었습니다.

---

## 👥 문의

프로젝트 관련 문의사항이 있으시면 이슈를 등록해주세요.

