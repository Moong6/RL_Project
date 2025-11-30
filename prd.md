프로젝트명

불확실한 수요 환경에서의 적응형 재고 관리 

1. 제품 개요
1.1 한 줄 정의

사용자가 리드타임, 창고 용량, 비용 구조, 평일/주말 수요 비율, 수요 불확실성/패턴을 직접 설정하면,
그 설정에 맞춰 재고·수요·입고·주문 패턴을 시뮬레이션하고 시각화해주는 웹 페이지.

1.2 목적

RL 프로젝트(RL_project.ipynb)에서 정의한 WarehouseEnv / 비용 구조 / 보상 함수를
브라우저에서 직관적으로 체험할 수 있는 시뮬레이션 UI 제공

사용자가 아래를 직접 조정하며 결과를 눈으로 확인:

재고 레벨 변화

품절 발생(Stockout)

비용(재고 보유비, 품절 패널티, 주문 비용)

특히:

평일 vs 주말 수요 비율 (Weekend / Weekday Ratio)

수요 불확실성 (Uncertainty Level)

수요 패턴 (Stable / Seasonal / Trending / Volatile)
이 재고 전략에 어떤 영향을 주는지 체험하게 하는 것이 핵심.

구현은 HTML + CSS + Vanilla JS + Chart.js로 완결되며,
향후 RL_project.ipynb에서 학습한 DQN 정책을 API로 붙이기 쉽게 구조화.

2. 주요 사용자 & 시나리오
2.1 사용자

강화학습/재고관리 실습을 해보는 학생·실무자

발표 시 데모를 보는 교수/동료

RL_project.ipynb 코드를 이해하고 싶은 사람 (환경/보상 체험용)

2.2 대표 시나리오

사용자가 웹 페이지에 접속한다.

왼쪽 설정 패널에서 다음 항목들을 입력/선택한다.

Lead Time (Min / Max)

Warehouse Scale (Max Capacity / Max Daily Demand)

Cost Structure (Holding / Stockout / Purchase / Fixed Order)

Demand Profile

Base Weekday Demand

Weekend / Weekday Demand Ratio

Demand Uncertainty Level (Low / Medium / High / Very High)

Demand Pattern (Stable / Seasonal / Trending / Volatile)

Simulation Horizon (Days, 기본 180일)

Run Simulation 버튼 클릭.

JS(app.js)에서 다음이 수행된다.

폼에서 config 읽기 (readConfigFromForm)

config 유효성 검사 (validateConfig)

초기 상태 생성 (initializeState)

runSimulation으로 180일 동안 시뮬레이션 실행

매일 수요 생성(generateDemand)

간단한 목표재고 정책(decideOrderQty)으로 주문량 결정

stepEnvironment에서 재고/수요/입고/품절/비용/보상 업데이트

computeKpis로 KPI 계산

renderChart, renderKpis, renderTable로 시각화 & 요약

오른쪽 영역에:

Inventory / Demand / Incoming / Order Qty(7일 이동 평균) 그래프

Average Inventory / Average Demand / Total Stockout / Total Cost KPI 카드

(옵션) Daily table (처음 30일)

사용자는 설정 값을 변경해 여러 번 시뮬레이션 돌리고,
그래프의 라인 on/off 필터를 사용해 특정 지표만 보거나 비교하며
재고 전략과 성과가 어떻게 달라지는지 관찰한다.

3. 환경 파라미터 (사용자 입력값 / UI)
3.1 Python 환경과의 대응 (RL_project 기반 개념)

RL_project.ipynb에서 사용한 WarehouseEnv의 핵심 파라미터 구조를 브라우저로 가져오는 개념:

def __init__(self,
             min_lead_time=2,
             max_lead_time=3):
    self.MIN_LEAD_TIME   = min_lead_time
    self.MAX_LEAD_TIME   = max_lead_time

    self.MAX_CAPACITY    = 200_000
    self.MAX_DEMAND      = 200_000

    self.HOLDING_COST    = 0.5
    self.STOCKOUT_COST   = 50.0
    self.PURCHASE_COST   = 20.0
    self.FIXED_ORDER_COST = 1_000.0


웹에서는 이 구조를 JS에서 그대로 config로 사용하고,
사용자가 각 값을 직접 입력 가능하게 함.

3.2 HTML Form 입력 항목 (실제 구현 기준)

index.html의 <form id="configForm"> 기준.

Lead Time

Min Lead Time (days) – #minLeadTime, 기본값: 2, 범위: 1 ~ 14

Max Lead Time (days) – #maxLeadTime, 기본값: 3, 범위: 1 ~ 30

Warehouse Scale

Max Capacity – #maxCapacity, 기본: 200000

Max Daily Demand – #maxDemand, 기본: 200000

Cost Structure

Holding Cost per Unit per Day – #holdingCost, 기본: 0.5

Stockout Cost per Unit – #stockoutCost, 기본: 50

Purchase Cost per Unit – #purchaseCost, 기본: 20

Fixed Order Cost per Order – #fixedOrderCost, 기본: 1000

Demand Profile

Base Weekday Demand – #baseWeekdayDemand, 기본: 12000
→ 평일 하루 평균 수요

Weekend / Weekday Demand Ratio – #weekendRatio, 기본: 1.3
→ 1.0이면 주말=평일, 1.5이면 주말 수요 1.5배

Demand Uncertainty Level – #demandUncertainty

low, medium, high, very-high (각 variance / shockProb 매핑)

Demand Pattern – #demandPattern

stable, seasonal, trending, volatile 중 선택

Simulation Horizon

Days – #horizonDays, 기본: 180, 현재 read-only

4. 수요 / 환경 로직 (JS 구현 기반 명세)
4.1 수요 생성 (generateDemand)

generateDemand(state, config)는 다음 요소를 조합해 수요를 만든다.

요일 효과 (평일/주말)

state.day >= 5 → 주말

평일: factor = 1.0

주말: factor = weekendRatio

수요 패턴(demandPattern)
config.demandPattern에 따라 다른 패턴 적용:

stable : patternFactor = 1.0 (거의 일정)

seasonal : 60일 주기 sinusoidal (성수기/비수기)

trending : 시간에 따라 점진적 증가

volatile : random walk 기반 volatile multiplier

기본 수요

baseDemand = baseWeekday * dayFactor * patternFactor;


불확실성(Variance) 적용

demandVariance에 비례하는 정규분포 noise 추가

low/medium/high/very-high에 따라 variance, shockProb 변화

Demand Shock

demandShockProb 확률로 spike/drop 발생

shockMagnitude 1.5~2.5배, 때때로 음수 방향(급감)

클램프 및 반올림

0 이상, MAX_DEMAND 이하

최종 값 Math.round

4.2 주문 정책 (decideOrderQty)

현재 웹 데모는 RL 에이전트 대신 간단한 휴리스틱 정책을 사용.

목표 재고: targetInventory = state.prevDemand * 7 (7일치 수요)

현재 재고 + 파이프라인 합을 기준으로 부족분 주문

너무 작은 주문량(평일수요의 50% 미만)은 0으로 처리 (주문 생략)

창고 용량 MAX_CAPACITY를 넘지 않도록 cap

→ 추후 RL_project.ipynb에서 학습된 DQN policy로 교체/선택할 수 있는 구조로 확장 예정.

4.3 환경 진행 (stepEnvironment)

오늘 도착 물량(incoming[0])을 재고에 반영

파이프라인 shift + 새로운 주문을 리드타임 위치에 적재

수요 생성(generateDemand)

판매/품절 계산 및 재고 감소

비용 구조 적용:

Holding Cost = 재고 * HOLDING_COST

Stockout Cost = stockout * STOCKOUT_COST

Variable Order Cost = orderQty * PURCHASE_COST

Fixed Order Cost = 주문 발생 시 FIXED_ORDER_COST

Total cost & reward (reward = -totalCost / 100000)

상태 업데이트(day, step, prevDemand, incoming)

기록(record) 구조:

day, inventory, demand, incomingAvg, orderQty, stockout, reward, totalCost

5. 페이지 기능 요구사항 (업데이트)
5.1 환경 설정 패널 (좌측)

index.html의 폼 구조를 유지하되,
라벨/설명 텍스트는 현재 코드 기준으로 PRD와 일치시킨다.

입력값 검증:

Min Lead Time ≤ Max Lead Time 이 아닐 경우 alert 후 중단

음수/0 값은 브라우저 input의 min/step으로 기본 방어

버튼:

Run Simulation

클릭 시 handleSimulation 호출

config → 초기 상태 → 시뮬레이션 → KPI/그래프/테이블 렌더

5.2 시뮬레이션 로직 (요약)

기존 handleSimulation / runSimulation / stepEnvironment 구조를 유지.

readConfigFromForm() : Form → config 객체

validateConfig(config) : 기본 검증

initializeState(config) :

초기 재고 ≈ 평일 수요의 5일치

prevDemand, day, incoming 초기화

runSimulation(initialState, config) :

horizonDays 동안 매일 decideOrderQty + stepEnvironment

history 배열에 record 누적

6. 시각화 요구사항 (업데이트: 필터 기능 포함)
6.1 메인 차트 (Chart.js)

현재 renderChart(history)에서 7일 이동평균 기준으로 4개 지표를 그린다.

X축: Day

Y축: Quantity

Dataset:

Inventory (7d MA)

Demand (7d MA)

Avg Incoming (7d MA)

Order Qty (7d MA)

✅ 신규 요구: 그래프 요소 on/off 필터링 기능

목표
사용자가 원하는 지표만 선택해서 볼 수 있도록,
각 지표의 라인을 토글(on/off) 할 수 있어야 한다.

구현 방법 제안 (둘 중 하나 또는 병행)

Legend 클릭 토글 (Chart.js 기본 기능 활용)

현재 legend는 options.plugins.legend.display: true 상태.

클릭 시 해당 dataset의 hidden을 토글하도록 Chart.js 기본 동작을 이용.

단, 사용자가 legend 토글을 잘 알아보기 어려운 경우가 있어, 아래 2번과 병행을 권장.

별도의 체크박스 필터 UI 추가

차트 상단 또는 우측에 체크박스 그룹 추가 (HTML):

 Inventory

 Demand

 Avg Incoming

 Order Qty

각 체크박스 변경 이벤트에서:

chartInstance.data.datasets[i].hidden = !checkbox.checked;
chartInstance.update();


초기 상태: 4개 모두 on.

사용자는 예를 들어 “재고 vs 수요만 보고 싶다”면 나머지 두 개 체크를 해제.

PRD 요구사항 정리

사용자는 그래프에서 보고 싶은 지표를 직접 선택/해제할 수 있어야 한다.

옵션:

Legend 클릭으로 토글 가능해야 한다.

추가적으로 명시적인 체크박스로도 on/off를 제어할 수 있도록 한다.

토글 상태는 시뮬레이션을 다시 돌려도 유지할지/초기화할지는 아래 중 하나를 선택:

간단 버전: 시뮬레이션 실행 시마다 4개 지표 모두 on으로 초기화

고급 버전: 토글 상태를 저장해 두었다가 새로운 history에도 그대로 적용

6.2 KPI 카드

카드 4개 고정:

Average Inventory (#kpiAvgInventory)

Average Demand (#kpiAvgDemand)

Total Stockout (#kpiTotalStockout)

Total Cost (#kpiTotalCost)

computeKpis(history)에서 계산한 값 사용.

6.3 Day-level Table (옵션)

renderTable(history)는 최대 30일치 기록만 렌더링.

기본은 display: none, 추후 “Show daily table” 토글 버튼 추가를 PRD 옵션으로 남김:

버튼 클릭 시 tableContainer show/hide

7. 화면 구조 / 디자인

index.html의 구조를 기반으로 PRD 정리.

상단 헤더:

제목: “Adaptive Inventory Control under Uncertain Demand”

부제: “불확실한 수요 환경에서 강화학습 에이전트가 어떻게 재고를 관리하는지 시각화합니다”

메인 레이아웃:

좌측: 설정 패널 (Form + Tip Box)

우측: Chart + KPI Cards + (Optional Table)

필요 CSS 가이드 (기존 styles.css 기준):

.layout { display: flex; min-height: 100vh; }

.sidebar { width: 320px; ... }

.content { flex: 1; ... }

.chart-container { height: 320~400px; }

.kpi-row { display:flex; gap:12px; }

.kpi-card { border-radius:8px; background:#f5f7fd; ... }

8. 기술 스택 & 코드 구조

HTML5 / CSS3 / Vanilla JS

Chart.js v4 (CDN) 사용

JS 엔트리: app.js

init: DOMContentLoaded → configForm submit 핸들링

핵심 함수:

readConfigFromForm()

validateConfig(config)

initializeState(config)

runSimulation(initialState, config)

decideOrderQty(state, config)

stepEnvironment(state, orderQty, config)

generateDemand(state, config)

computeKpis(history)

renderChart(history)

renderKpis(kpis)

renderTable(history)

유틸: movingAverage, randomInt, randomUniform, randomNormal

9. RL 연동 확장 (Roadmap)

향후 RL_project.ipynb와의 연동을 염두에 둔 요구사항:

Policy 선택 드롭다운 추가

Heuristic (Target Inventory Policy) – 현재 JS 정책

RL Policy (DQN) – 향후 Python 서버/모델 서빙으로 연결

RL 측에서 사용하는 상태 정의/보상 구조는
현재 웹 환경과 일치하도록 유지 (inventory, prevDemand, day, incoming, reward = -cost/scale).

장기적으로:

RL 학습 결과(예: baseline vs DQN reward 곡선)를
별도 탭/모달에서 보여주는 “RL Training Results” 섹션 추가 가능.