// ============================================================================
// ADAPTIVE INVENTORY CONTROL - SIMULATION & VISUALIZATION
// Based on RL_project.ipynb WarehouseEnv
// ============================================================================

// Global variables
let chartInstance = null;
let currentHistory = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Form submission handler
    const form = document.getElementById('configForm');
    form.addEventListener('submit', handleSimulation);
    
    // Chart filter checkboxes
    initializeChartFilters();
    
    // Table toggle button
    initializeTableToggle();
    
    // Optional: Run initial simulation with default values
    // handleSimulation(new Event('submit'));
});

// Initialize chart filter checkboxes
function initializeChartFilters() {
    const filters = ['filterInventory', 'filterDemand', 'filterIncoming', 'filterOrder'];
    filters.forEach((filterId, index) => {
        const checkbox = document.getElementById(filterId);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                toggleChartDataset(index, checkbox.checked);
            });
        }
    });
}

// Initialize table toggle button
function initializeTableToggle() {
    const toggleBtn = document.getElementById('toggleTableBtn');
    const tableContainer = document.getElementById('tableContainer');
    
    if (toggleBtn && tableContainer) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = tableContainer.style.display !== 'none';
            tableContainer.style.display = isVisible ? 'none' : 'block';
            toggleBtn.textContent = isVisible ? 'Show Table' : 'Hide Table';
        });
    }
}

// Toggle chart dataset visibility
function toggleChartDataset(datasetIndex, visible) {
    if (chartInstance && chartInstance.data.datasets[datasetIndex]) {
        chartInstance.data.datasets[datasetIndex].hidden = !visible;
        chartInstance.update();
    }
}

// ============================================================================
// MAIN SIMULATION HANDLER
// ============================================================================

function handleSimulation(event) {
    event.preventDefault();
    
    console.log('=== Starting Simulation ===');
    
    // 1. Read configuration from form
    const config = readConfigFromForm();
    console.log('Config:', config);
    
    // 2. Validate configuration
    if (!validateConfig(config)) {
        return;
    }
    
    // 3. Initialize state
    const initialState = initializeState(config);
    console.log('Initial State:', initialState);
    
    // 4. Run simulation (180 days)
    const history = runSimulation(initialState, config);
    currentHistory = history;
    console.log('Simulation completed:', history.length, 'days');
    
    // 5. Compute KPIs
    const kpis = computeKpis(history);
    console.log('KPIs:', kpis);
    
    // 6. Render results
    renderChart(history);
    renderKpis(kpis);
    renderTable(history);
    
    console.log('=== Simulation Complete ===');
}

// ============================================================================
// CONFIGURATION & VALIDATION
// ============================================================================

// Read configuration from form inputs
function readConfigFromForm() {
    const uncertaintyLevel = document.getElementById('demandUncertainty').value;
    const demandPattern = document.getElementById('demandPattern').value;
    
    // Map uncertainty level to variance and shock probability
    // Corresponds to PRD section 3.2 & 4.1
    const uncertaintyMap = {
        'low': { variance: 0.10, shockProb: 0.02 },      // ±10%, 2% shock
        'medium': { variance: 0.25, shockProb: 0.05 },   // ±25%, 5% shock
        'high': { variance: 0.40, shockProb: 0.10 },     // ±40%, 10% shock
        'very-high': { variance: 0.60, shockProb: 0.15 } // ±60%, 15% shock
    };
    
    const uncertainty = uncertaintyMap[uncertaintyLevel];
    
    // Match WarehouseEnv structure from RL_project.ipynb
    return {
        // Lead Time
        minLeadTime: parseInt(document.getElementById('minLeadTime').value),
        maxLeadTime: parseInt(document.getElementById('maxLeadTime').value),
        
        // Warehouse Scale
        MAX_CAPACITY: parseInt(document.getElementById('maxCapacity').value),
        MAX_DEMAND: parseInt(document.getElementById('maxDemand').value),
        
        // Cost Structure (matches RL_project.ipynb)
        HOLDING_COST: parseFloat(document.getElementById('holdingCost').value),
        STOCKOUT_COST: parseFloat(document.getElementById('stockoutCost').value),
        PURCHASE_COST: parseFloat(document.getElementById('purchaseCost').value),
        FIXED_ORDER_COST: parseFloat(document.getElementById('fixedOrderCost').value),
        
        // Demand Profile
        baseWeekdayDemand: parseInt(document.getElementById('baseWeekdayDemand').value),
        weekendRatio: parseFloat(document.getElementById('weekendRatio').value),
        demandVariance: uncertainty.variance,
        demandShockProb: uncertainty.shockProb,
        demandPattern: demandPattern,
        
        // Simulation Horizon
        horizonDays: parseInt(document.getElementById('horizonDays').value)
    };
}

// Validate configuration (PRD section 5.1)
function validateConfig(config) {
    // Check lead time constraint
    if (config.minLeadTime > config.maxLeadTime) {
        alert('Error: Min Lead Time cannot be greater than Max Lead Time');
        return false;
    }
    
    // Check for negative values
    if (config.MAX_CAPACITY <= 0 || config.MAX_DEMAND <= 0 || 
        config.baseWeekdayDemand <= 0) {
        alert('Error: Capacity, demand values must be positive');
        return false;
    }
    
    // Check cost values
    if (config.HOLDING_COST < 0 || config.STOCKOUT_COST < 0 || 
        config.PURCHASE_COST < 0 || config.FIXED_ORDER_COST < 0) {
        alert('Error: Cost values cannot be negative');
        return false;
    }
    
    return true;
}

// ============================================================================
// STATE INITIALIZATION
// ============================================================================

// Initialize simulation state (PRD section 5.2)
function initializeState(config) {
    // Create incoming pipeline array (length = maxLeadTime)
    const incoming = new Array(config.maxLeadTime).fill(0);
    
    return {
        day: 0,                                      // Day of week (0-6)
        step: 0,                                     // Simulation step counter
        inventory: config.baseWeekdayDemand * 5,     // Start with ~5 days of inventory
        prevDemand: config.baseWeekdayDemand,        // Previous demand for policy
        incoming: incoming,                          // Incoming delivery pipeline
        volatileMultiplier: 1.0                      // For volatile demand pattern
    };
}

// ============================================================================
// SIMULATION LOOP
// ============================================================================

// Main simulation loop (PRD section 5.2)
function runSimulation(initialState, config) {
    let state = { 
        ...initialState, 
        incoming: [...initialState.incoming],
        volatileMultiplier: initialState.volatileMultiplier
    };
    const history = [];
    
    // Simulate for specified number of days
    for (let t = 0; t < config.horizonDays; t++) {
        // 1. Decide order quantity (policy)
        const orderQty = decideOrderQty(state, config);
        
        // 2. Step environment (demand, costs, rewards)
        const { nextState, record } = stepEnvironment(state, orderQty, config);
        
        // 3. Record history
        history.push(record);
        
        // 4. Update state for next iteration
        state = nextState;
    }
    
    return history;
}

// ============================================================================
// ORDER POLICY (HEURISTIC)
// ============================================================================

// Simple policy: target inventory level (PRD section 4.2)
// Future: Replace with RL policy from RL_project.ipynb
function decideOrderQty(state, config) {
    // Target inventory = 7 days of expected demand
    // This is a simple heuristic policy
    const targetInventory = state.prevDemand * 7;
    
    // Calculate projected inventory (current + pipeline)
    const totalIncoming = state.incoming.reduce((sum, qty) => sum + qty, 0);
    const projectedInventory = state.inventory + totalIncoming;
    
    // Calculate order quantity to reach target
    let orderQty = targetInventory - projectedInventory;
    
    // Minimum order threshold (avoid tiny orders due to fixed cost)
    const minOrderThreshold = config.baseWeekdayDemand * 0.5;
    if (orderQty < minOrderThreshold) {
        orderQty = 0;  // Don't order if below threshold
    }
    
    // Cap at max capacity
    orderQty = Math.max(0, Math.min(orderQty, config.MAX_CAPACITY));
    
    return Math.round(orderQty);
}

// ============================================================================
// ENVIRONMENT STEP FUNCTION
// ============================================================================

// Environment step function (PRD section 4.3)
// Matches RL_project.ipynb WarehouseEnv.step() logic
function stepEnvironment(state, orderQty, config) {
    const newState = { ...state };
    
    // 1. Process incoming delivery (from pipeline[0])
    const todayIncoming = newState.incoming[0];
    newState.inventory += todayIncoming;
    
    // 2. Shift pipeline left and add new order at the end
    newState.incoming.shift();
    const leadTime = randomInt(config.minLeadTime, config.maxLeadTime);
    
    // Pad pipeline to maintain maxLeadTime length
    while (newState.incoming.length < config.maxLeadTime) {
        newState.incoming.push(0);
    }
    
    // Place new order in pipeline at lead time position
    if (leadTime <= newState.incoming.length && orderQty > 0) {
        newState.incoming[leadTime - 1] += orderQty;
    }
    
    // 3. Generate demand for today
    const demand = generateDemand(newState, config);
    
    // 4. Process sales and calculate stockout
    const sales = Math.min(demand, newState.inventory);
    const stockout = Math.max(0, demand - newState.inventory);
    newState.inventory = Math.max(0, newState.inventory - demand);
    
    // 5. Cap inventory at max capacity
    newState.inventory = Math.min(newState.inventory, config.MAX_CAPACITY);
    
    // 6. Calculate costs (matches RL_project cost structure)
    const holdingCost = newState.inventory * config.HOLDING_COST;
    const stockoutPenalty = stockout * config.STOCKOUT_COST;
    const variableOrderCost = orderQty * config.PURCHASE_COST;
    const fixedOrderCost = orderQty > 0 ? config.FIXED_ORDER_COST : 0;
    
    const totalCost = holdingCost + stockoutPenalty + variableOrderCost + fixedOrderCost;
    const reward = -totalCost / 100000.0; // Scaled reward (matches RL training)
    
    // 7. Update state for next step
    newState.prevDemand = demand;
    newState.step += 1;
    newState.day = (newState.day + 1) % 7;
    
    // 8. Create history record
    const avgIncoming = newState.incoming.reduce((sum, qty) => sum + qty, 0) / newState.incoming.length;
    
    const record = {
        day: newState.step,
        inventory: newState.inventory,
        demand: demand,
        incomingAvg: avgIncoming,
        orderQty: orderQty,
        stockout: stockout,
        reward: reward,
        totalCost: totalCost
    };
    
    return { nextState: newState, record };
}

// ============================================================================
// DEMAND GENERATION
// ============================================================================

// Generate demand based on config (PRD section 4.1)
// Realistic demand with controllable uncertainty
function generateDemand(state, config) {
    const baseWeekday = config.baseWeekdayDemand;
    const weekendRatio = config.weekendRatio;
    
    // 1. Day of week effect (weekday vs weekend)
    // state.day: 0-6 (Mon-Sun), where 5-6 = weekend
    const isWeekend = state.day >= 5;
    const dayFactor = isWeekend ? weekendRatio : 1.0;
    
    // 2. Pattern-based factor (PRD section 4.1)
    let patternFactor = 1.0;
    const progress = state.step / config.horizonDays;
    
    switch(config.demandPattern) {
        case 'stable':
            // Stable demand with minimal variation
            patternFactor = 1.0;
            break;
            
        case 'seasonal':
            // Seasonal pattern with ~60 day cycle
            patternFactor = 1.0 + 0.3 * Math.sin(2 * Math.PI * state.step / 60);
            break;
            
        case 'trending':
            // Gradual upward trend
            patternFactor = 1.0 + 0.4 * progress;
            break;
            
        case 'volatile':
            // Random walk - unpredictable changes
            if (!state.volatileMultiplier) {
                state.volatileMultiplier = 1.0;
            }
            // Small changes accumulate over time
            const change = randomUniform(-0.15, 0.15);
            state.volatileMultiplier = Math.max(0.5, Math.min(1.5, state.volatileMultiplier + change));
            patternFactor = state.volatileMultiplier;
            break;
    }
    
    // 3. Base demand calculation
    let baseDemand = baseWeekday * dayFactor * patternFactor;
    
    // 4. Apply uncertainty (configurable variance)
    // Use normal distribution for realistic randomness
    const stdDev = baseDemand * config.demandVariance;
    const randomComponent = randomNormal(0, stdDev);
    let finalDemand = baseDemand + randomComponent;
    
    // 5. Demand shocks (sudden spikes or drops)
    if (Math.random() < config.demandShockProb) {
        // Positive shock (spike) or negative shock (drop)
        const isPositive = Math.random() > 0.3;
        const shockMagnitude = randomUniform(1.5, 2.5) * (isPositive ? 1 : -0.5);
        finalDemand *= shockMagnitude;
    }
    
    // 6. Clamp to valid range
    finalDemand = Math.max(0, Math.min(finalDemand, config.MAX_DEMAND));
    
    return Math.round(finalDemand);
}

// ============================================================================
// KPI COMPUTATION
// ============================================================================

// Compute KPIs from simulation history (PRD section 6.2)
function computeKpis(history) {
    const n = history.length;
    
    if (n === 0) {
        return {
            avgInventory: 0,
            avgDemand: 0,
            totalStockout: 0,
            totalCost: 0
        };
    }
    
    const avgInventory = history.reduce((sum, rec) => sum + rec.inventory, 0) / n;
    const avgDemand = history.reduce((sum, rec) => sum + rec.demand, 0) / n;
    const totalStockout = history.reduce((sum, rec) => sum + rec.stockout, 0);
    const totalCost = history.reduce((sum, rec) => sum + rec.totalCost, 0);
    
    return {
        avgInventory: Math.round(avgInventory),
        avgDemand: Math.round(avgDemand),
        totalStockout: Math.round(totalStockout),
        totalCost: Math.round(totalCost)
    };
}

// ============================================================================
// CHART RENDERING
// ============================================================================

// Render chart using Chart.js (PRD section 6.1)
function renderChart(history) {
    const ctx = document.getElementById('inventoryChart').getContext('2d');
    
    // Calculate 7-day moving averages for smoothing
    const windowSize = 7;
    const inventory7d = movingAverage(history.map(r => r.inventory), windowSize);
    const demand7d = movingAverage(history.map(r => r.demand), windowSize);
    const incoming7d = movingAverage(history.map(r => r.incomingAvg), windowSize);
    const order7d = movingAverage(history.map(r => r.orderQty), windowSize);
    
    const labels = history.map(r => r.day);
    
    // Get current filter states
    const filterStates = [
        document.getElementById('filterInventory').checked,
        document.getElementById('filterDemand').checked,
        document.getElementById('filterIncoming').checked,
        document.getElementById('filterOrder').checked
    ];
    
    // Destroy previous chart if exists
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart with 4 datasets
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Inventory (7d MA)',
                    data: inventory7d,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.3,
                    fill: false,
                    hidden: !filterStates[0]
                },
                {
                    label: 'Demand (7d MA)',
                    data: demand7d,
                    borderColor: 'rgb(249, 115, 22)',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false,
                    hidden: !filterStates[1]
                },
                {
                    label: 'Avg Incoming (7d MA)',
                    data: incoming7d,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 2,
                    borderDash: [2, 4],
                    tension: 0.3,
                    fill: false,
                    hidden: !filterStates[2]
                },
                {
                    label: 'Order Qty (7d MA)',
                    data: order7d,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    stepped: true,
                    tension: 0,
                    fill: false,
                    hidden: !filterStates[3]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: false  // Using HTML title instead
                },
                legend: {
                    display: true,
                    position: 'top',
                    onClick: function(e, legendItem, legend) {
                        // Enable legend click to toggle datasets
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;
                        const meta = chart.getDatasetMeta(index);
                        
                        // Toggle visibility
                        meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                        
                        // Update corresponding checkbox
                        const checkboxes = ['filterInventory', 'filterDemand', 'filterIncoming', 'filterOrder'];
                        const checkbox = document.getElementById(checkboxes[index]);
                        if (checkbox) {
                            checkbox.checked = !meta.hidden;
                        }
                        
                        chart.update();
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return 'Day ' + context[0].label;
                        },
                        label: function(context) {
                            return context.dataset.label + ': ' + Math.round(context.parsed.y).toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Day',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        maxTicksLimit: 20
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Quantity',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// ============================================================================
// KPI RENDERING
// ============================================================================

// Render KPI cards (PRD section 6.2)
function renderKpis(kpis) {
    document.getElementById('kpiAvgInventory').textContent = kpis.avgInventory.toLocaleString();
    document.getElementById('kpiAvgDemand').textContent = kpis.avgDemand.toLocaleString();
    document.getElementById('kpiTotalStockout').textContent = kpis.totalStockout.toLocaleString();
    document.getElementById('kpiTotalCost').textContent = kpis.totalCost.toLocaleString();
}

// ============================================================================
// TABLE RENDERING
// ============================================================================

// Render daily table (PRD section 6.3)
// Shows first 30 days for performance
function renderTable(history) {
    const tableBody = document.getElementById('dailyTableBody');
    tableBody.innerHTML = '';
    
    // Display only first 30 days
    const displayHistory = history.slice(0, 30);
    
    displayHistory.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.day}</td>
            <td>${Math.round(record.inventory).toLocaleString()}</td>
            <td>${Math.round(record.demand).toLocaleString()}</td>
            <td>${Math.round(record.incomingAvg).toLocaleString()}</td>
            <td>${Math.round(record.orderQty).toLocaleString()}</td>
            <td>${Math.round(record.stockout).toLocaleString()}</td>
            <td>${record.reward.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Calculate moving average for smoothing time series
function movingAverage(data, windowSize) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = data.slice(start, i + 1);
        const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
        result.push(avg);
    }
    return result;
}

// Random integer between min and max (inclusive)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random uniform float between min and max
function randomUniform(min, max) {
    return Math.random() * (max - min) + min;
}

// Random normal distribution using Box-Muller transform
function randomNormal(mean, stdDev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
}

