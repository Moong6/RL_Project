
# 📦 불확실한 수요 환경에서의 적응형 재고 관리 (Adaptive Inventory Control under Uncertain Demand)

> **Team Q-Pang** | 2025 서강대학교 AI·SW대학원 강화학습의 기초 프로젝트

## 📖 프로젝트 개요

이커머스와 홈쇼핑 산업에서 가장 큰 난제는 \*\*"재고 과다(비용 증가)와 재고 부족(매출 손실/고객 신뢰 하락) 사이의 균형"\*\*을 맞추는 것입니다.

본 프로젝트는 불확실한 수요 패턴(계절성, 주말 급증, 장기 추세)과 리드타임이 존재하는 물류 환경에서, **Double DQN(Deep Q-Network)** 알고리즘을 활용하여 총 운영 비용을 최소화하는 **적응형 재고 관리 에이전트**를 구현하고 검증하는 것을 목표로 합니다.

또한, 학습된 에이전트가 활동하는 환경을 직관적으로 이해할 수 있도록 **웹 기반 시뮬레이터**를 함께 제공합니다.

### 👥 팀원 소개 (Team : Q-Pang)
  팀명 : Q-learning 을 활용하여 쿠팡(이커머스/물류 대표 기업)과 같은 영향력으로 물류 산업에 이바지하고자 함.
  * **어준성** (A71035 / 데이터사이언스·인공지능): (기획) 주제 선정, 데이터셋 설계 및 가상 환경 모델링, 프로젝트 시각화 자료 작성
  * **유문식** (A72063 / 데이터사이언스·인공지능): (개발) RL에이전트 구현 및 알고리즘 성능 최적화 및 결과 분석, 시뮬레이터 개발

-----

## 🏗️ 방법론 (Methodology)

### 1\. 환경 및 데이터셋 (Environment)

단순 무작위 데이터가 아닌 현실적인 유통 데이터를 통계적으로 모사하여 구축했습니다.

  * **수요 생성**: Poisson 분포 기반, 60일 주기 계절성(Seasonality), 장기 추세(Trend), 평일 대비 1.3배 주말 수요 반영
  * **제약 조건**: 무작위 리드타임(Lead Time, 2\~3일), 창고 용량 제한

### 2\. MDP 정의 (Markov Decision Process)

  * **State ($S_t$)**: 의사결정에 필요한 핵심 정보 4가지
      * 현재 재고량 (Inventory Level)
      * 전일 수요량 (Previous Demand)
      * 요일 정보 (Day of Week)
      * 입고 예정 물량 (Pipeline Inventory)
  * **Action ($A_t$)**: 주문 수량 (Discrete)
      * $\{0, 10,000, 20,000, ..., 100,000\}$ (대규모 창고 스케일)
  * **Reward ($R_t$)**: 비용 최소화를 위한 음의 보상 함수
      * $R_t = -(0.5 \times \text{Inv} + 50 \times \text{Stockout} + 1000 \times \text{FixedCost} + \text{Purchase})$
      * *특징: 품절 패널티를 유지비의 100배로 설정하여 고객 신뢰를 최우선으로 함.*

### 3\. 알고리즘 (Algorithm)

  * **Model**: Double DQN (DDQN) - Q-value 과대평가(Overestimation) 문제 해결
  * **Network**: Input → FC(256) → ReLU → FC(256) → Output
  * **Optimization**: Replay Buffer (100k), Batch Size (256), $\epsilon$-Decay (0.9998)

-----

## 📊 실험 결과 및 분석

180일(약 6개월) 단위의 에피소드 반복 학습 결과, 에이전트는 다음과 같은 고도화된 전략을 스스로 학습했습니다.

1.  **안전 재고 확보 (High Safety Stock)**: 품절 비용이 매우 높게 설정된 환경을 인지하여, 수요 변동성에 대비해 넉넉한 재고를 상시 유지함.
2.  **배치 주문 (Batch Ordering)**: 매일 주문하는 대신, 고정 주문 비용(Fixed Cost)을 절감하기 위해 최적 시점에 대량으로 주문하는 패턴 발생.
3.  **성능 수렴**: 초기 무작위 탐험 대비 약 **70% 이상의 비용 절감 효과** 달성.

-----

## 💻 웹 시뮬레이터 (Web Demo)

RL 에이전트가 학습하는 \*\*물류 환경(WarehouseEnv)\*\*을 웹 브라우저에서 직접 체험하고 파라미터를 실험해 볼 수 있는 도구입니다.

### 🚀 실행 방법

별도의 설치 없이 로컬 서버를 통해 실행 가능합니다.

방법 1. 로컬 파일 직접 실행
다운로드한 폴더 내의 index.html 파일을 더블 클릭하거나 브라우저로 드래그하여 엽니다.

방법 2. 로컬 서버 실행 (권장)
Chrome 등 최신 브라우저의 보안 정책(CORS 등)에 구애받지 않고 원활하게 실행하려면 로컬 서버를 권장합니다.




**Python이 설치되어 있는 경우**

python -m http.server 8000

**또는 Node.js가 설치되어 있는 경우**

npx serve
```

브라우저에서 `http://localhost:8000`으로 접속하세요.

### 🎮 기능 가이드

#### 1\. 환경 설정 (Configuration)

좌측 패널에서 시뮬레이션 파라미터를 조정할 수 있습니다.

  * **Lead Time**: 주문 도착 지연 시간 (랜덤 범위 설정)
  * **Cost Structure**: 재고 유지비 vs 품절 패널티 비율 조정
  * **Demand Profile**:
      * *Uncertainty*: 수요 예측 불확실성 레벨 (Low \~ Very High)
      * *Pattern*: 수요 패턴 (Stable, Seasonal, Trending, Volatile)

#### 2\. 결과 시각화 (Visualization)

`Run Simulation` 버튼을 누르면 180일간의 시뮬레이션 결과가 나타납니다.

  * **메인 차트**: 재고량(Inventory), 수요(Demand), 주문량(Order Qty)의 변화 추이 확인
      * *Tip: 차트 범례를 클릭하여 보고 싶은 지표만 필터링 가능*
  * **KPI 카드**: 평균 재고, 총 품절 횟수, 총 운영 비용 요약

### 🧪 추천 실험 시나리오

1.  **채찍 효과 (Bullwhip Effect)**: `Uncertainty`를 'High'로 설정하여 작은 수요 변동이 주문량에 미치는 영향 확인
2.  **안전 재고의 중요성**: `Stockout Cost`를 높게 설정하여 에이전트(현재는 Heuristic)가 재고 수준을 어떻게 변화시키는지 관찰

-----

## 🛠 기술 스택

  * **Core AI**: Python, PyTorch, Gymnasium
  * **Web Demo**: HTML5, CSS3, Vanilla JS, Chart.js v4

-----

## 🗺️ 향후 과제 (Future Work)

  * **알고리즘 확장**: DDPG, SAC 등 연속적인 주문량을 제어할 수 있는 알고리즘 적용
  * **환경 고도화**: 다품목(Multi-item) 혼적 최적화 및 유통기한(Perishable) 제약 추가
  * **웹 연동**: 학습된 PyTorch DQN 모델을 웹 데모에 연동하여 실시간 추론 시각화

-----

## 📄 라이선스


본 프로젝트는 서강대학교 AI·SW대학원 '강화학습의 기초' 수업 과제로 제작되었습니다.



