PRD
프로젝트명

불확실한 수요 환경에서의 적응형 재고 관리 – 체험형 웹 데모

1. 제품 개요
1.1 한 줄 정의

사용자가 리드타임, 창고 용량, 비용 구조, 평일/주말 수요 비율을 직접 설정하면,
그 설정에 맞춰 재고·수요·입고·주문 패턴을 시뮬레이션하고 시각화해주는 웹 페이지.

1.2 목적

Python 코드의 WarehouseEnv 파라미터들을 브라우저에서 직접 조정해 보며,

재고 레벨,

품절 발생,

비용(보유/품절/주문)
에 어떤 영향을 주는지 체험하게 한다.

특히 **“평일 vs 주말 수요 비율”**을 사용자가 직접 조정하여,
주말 수요가 강해질수록 재고 전략이 어떻게 바뀌는지 확인할 수 있게 한다.

구현은 HTML + CSS + Vanilla JS로 완결되며, 이후 RL 정책 API를 붙이기 쉽게 설계한다.

2. 주요 사용자 & 시나리오
2.1 사용자

강화학습/재고관리 실습을 해보는 학생, 실무자

발표를 보는 교수/동료 (데모 체험용)

2.2 대표 시나리오

사용자가 페이지에 접속한다.

왼쪽 패널에서 다음 값을 입력:

리드타임(최소/최대)

창고 최대 용량, 하루 최대 수요

보유비/품절비/매입비/고정 주문비

평일 수요 수준, 주말 수요倍率(평일 대비 몇 배)

Run Simulation 버튼 클릭.

JS가 180일 동안 환경을 시뮬레이션:

매일 수요 생성(평일/주말 비율 반영)

간단한 정책(또는 RL 정책 호출)으로 주문량 결정

재고/입고/품절/비용 업데이트

오른쪽 영역에:

Inventory / Demand / Incoming / Order Qty 그래프 표시

평균 재고, 총 품절량, 총 비용 등의 지표 카드 표시

사용자는 평일/주말 비율·비용 구조를 바꿔가며 여러 번 실행,
재고 전략과 성과가 어떻게 바뀌는지 비교해 본다.

3. 환경 파라미터 (사용자 입력값)

Python 코드의 __init__ 기본값을 UI 기본값으로 사용한다.

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

3.1 UI 입력 항목 (모두 number input, 기본값 위 코드 기준)

Lead Time

Min Lead Time (days) – 기본값: 2, 범위: 1 ~ 14

Max Lead Time (days) – 기본값: 3, 범위: Min ~ 30

Warehouse Scale

Max Capacity – 기본값: 200000

Max Daily Demand – 기본값: 200000

Cost Structure

Holding Cost per Unit per Day – 기본값: 0.5

Stockout Cost per Unit – 기본값: 50

Purchase Cost per Unit – 기본값: 20

Fixed Order Cost per Order – 기본값: 1000

Demand Profile (평일/주말 비율 관련)

Base Weekday Demand – 기본값: 12000
(평일 하루 평균 수요)

Weekend / Weekday Demand Ratio – 기본값: 1.3

사용자가 “주말은 평일의 몇 배인지” 직접 입력

예: 1.0 → 주말 = 평일과 동일
1.5 → 주말 수요 50% 증가

(옵션) Seasonality Amplitude – 기본값: 0.5

(옵션) Demand Noise Range – 기본값: 0.8 ~ 1.2
→ UI에는 Low/Medium/High 선택으로 구현해도 됨.

Simulation Horizon

Days – 기본값: 180 (read-only 또는 number)

4. 수요 및 환경 로직 (JS 의사 코드 수준 명세)
4.1 수요 생성 함수 (평일/주말 비율 반영)
function generateDemand(state, config) {
  const baseWeekday = config.baseWeekdayDemand;        // 평일 평균 수요
  const weekendRatio = config.weekendRatio;            // 주말/평일 비율 (ex: 1.3)

  // 1) 요일 효과
  const weekdayFactor = 1.0;
  const weekendFactor = weekendRatio;
  const dayFactor = (state.day >= 5) ? weekendFactor : weekdayFactor;

  // 2) 시즌 효과 (선택)
  const seasonAmp     = config.seasonAmplitude;        // 기본 0.5
  const seasonPeriod  = config.seasonPeriod;           // 기본 60일
  const seasonFactor  = 1.0 + seasonAmp * Math.sin(
    2 * Math.PI * (state.step / seasonPeriod)
  );

  // 3) 추세 효과 (초기→후반 수요 증가)
  const trendFactor = 1.0 + config.trendFactorMax * (
    state.step / config.horizonDays
  );

  // 4) 랜덤 노이즈
  const noiseFactor = randomUniform(config.noiseLow, config.noiseHigh);

  // 최종 λ
  let lambda = baseWeekday * dayFactor * seasonFactor * trendFactor * noiseFactor;
  lambda = Math.max(1, Math.min(lambda, config.MAX_DEMAND));

  return poissonSample(lambda);  // or 정규 근사
}


사용자는 weekendRatio를 직접 입력 → 그래프에서 주말 봉우리 차이가 바로 보이게.

4.2 비용 계산 (Python과 의미 같게)
const holdingCost     = inventory * config.HOLDING_COST;
const stockoutPenalty = stockout  * config.STOCKOUT_COST;
const variableOrder   = orderQty  * config.PURCHASE_COST;
const fixedOrder      = orderQty > 0 ? config.FIXED_ORDER_COST : 0;

const totalCost = holdingCost + stockoutPenalty + variableOrder + fixedOrder;
const reward    = -totalCost / 100000.0;  // 스케일링

5. 페이지 기능 요구사항
5.1 환경 설정 패널 (좌측)

섹션 구분:

Environment (Lead Time, Capacity, Max Demand)

Cost Structure

Demand Profile (Weekday/Weekend, Seasonality)

Simulation (Days)

각 항목에는:

label (영어), placeholder 값, 기본값 설정

잘못된 입력(음수, Min > Max 등) 시 간단한 validation 메시지

버튼:

Run Simulation

클릭 시 현재 form 값으로 config 객체 생성

runSimulation(initialState, config) 호출

결과를 차트 + KPI에 반영

5.2 시뮬레이션 로직 (요약)
function runSimulation(initialState, config) {
  let state = {
    day: initialState.day,
    step: 0,
    inventory: initialState.inventory,
    prevDemand: initialState.prevDemand,
    incoming: initialState.incoming   // 길이 maxLeadTime 배열
  };

  const history = [];

  for (let t = 0; t < config.horizonDays; t++) {
    const orderQty = decideOrderQty(state, config);          // 정책 함수
    const { nextState, record } = stepEnvironment(state, orderQty, config);
    history.push(record);
    state = nextState;
  }
  return history;
}


decideOrderQty: 간단한 목표 재고 기반 정책 (앞서 정의) 또는 추후 RL API로 교체 가능.

stepEnvironment: 오늘 입고 반영 → 파이프라인 이동 → 주문 반영 → 수요·판매 → 비용 계산.

5.3 시각화

그래프 1 – Inventory / Demand / Incoming / Order Qty (180 Days)

x축: Day

y축: Quantity

시리즈 (7-day Moving Average):

Inventory (blue, 실선)

Demand (orange, dashed)

Avg Incoming Qty (green, dot-dash)

Order Qty (red, step line)

KPI 카드

Average Inventory

Total Stockout

Total Cost

Average Daily Demand

툴팁

마우스 hover 시 해당 일자의 원 데이터 출력:

Day, Inventory, Demand, Incoming Avg, Order Qty, Stockout, Reward

6. 화면 구조 (와이어프레임)
HTML 구조 개요
<header>
  <h1>Adaptive Inventory Control under Uncertain Demand</h1>
  <p>사용자가 직접 파라미터를 조정하며 재고·수요 패턴을 체험하는 데모</p>
</header>

<main class="layout">
  <aside class="sidebar">
    <!-- form: environment & demand parameters -->
  </aside>

  <section class="content">
    <div class="chart-container">
      <canvas id="inventoryChart"></canvas>
    </div>

    <div class="kpi-row">
      <!-- KPI cards -->
    </div>

    <div class="table-container">
      <!-- optional daily table -->
    </div>
  </section>
</main>

CSS 기본 가이드

.layout { display: flex; min-height: 100vh; }

.sidebar { width: 320px; padding: 16px; border-right: 1px solid #eee; background:#fafafa; }

.content { flex: 1; padding: 16px 24px; }

.form-group { margin-bottom: 12px; }

.kpi-row { display:flex; gap:12px; margin-top:12px; }

.kpi-card { flex:1; padding:10px 14px; border-radius:8px; background:#f5f7fd; }

7. 기술 스택 & 구현 규칙

HTML5, CSS3, Vanilla JS

그래프: Chart.js (CDN)

JS 파일: app.js (초기화 + 이벤트 바인딩 + 시뮬레이션 + 렌더링)

함수 분리:

readConfigFromForm()

generateDemand()

decideOrderQty()

stepEnvironment()

runSimulation()

computeKpis()

renderChart(history)

renderKpis(kpis)

8. 체험 포인트 (UX 관점)

평일/주말 비율 입력칸 옆에 짧은 설명:

“Weekend / Weekday Demand Ratio
1.0 → 주말 = 평일, 1.5 → 주말 수요 1.5배”

비용 구조 값을 극단적으로 바꿔볼 것을 안내:

Holding Cost ↑ → 재고 레벨 낮아짐

Stockout Cost ↑ → 재고 레벨 높아짐

“Tip” 박스:

“주말 비율을 2.0 이상으로 올리면, 그래프에서 주말 근처 재고 피크가 어떻게 바뀌는지 확인해 보세요.”