// Global variables
let chartInstance = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('configForm');
    form.addEventListener('submit', handleSimulation);
    
    // Run initial simulation with default values
    // handleSimulation(new Event('submit'));
});

// Main simulation handler
function handleSimulation(event) {
    event.preventDefault();
    
    // Read configuration from form
    const config = readConfigFromForm();
    
    // Validate configuration
    if (!validateConfig(config)) {
        return;
    }
    
    // Initialize state
    const initialState = initializeState(config);
    
    // Run simulation
    const history = runSimulation(initialState, config);
    
    // Compute KPIs
    const kpis = computeKpis(history);
    
    // Render results
    renderChart(history);
    renderKpis(kpis);
    renderTable(history);
}

// Read configuration from form inputs
function readConfigFromForm() {
    const uncertaintyLevel = document.getElementById('demandUncertainty').value;
    const demandPattern = document.getElementById('demandPattern').value;
    
    // Map uncertainty level to variance
    const uncertaintyMap = {
        'low': { variance: 0.10, shockProb: 0.02 },      // ±10%, 2% shock probability
        'medium': { variance: 0.25, shockProb: 0.05 },   // ±25%, 5% shock probability
        'high': { variance: 0.40, shockProb: 0.10 },     // ±40%, 10% shock probability
        'very-high': { variance: 0.60, shockProb: 0.15 } // ±60%, 15% shock probability
    };
    
    const uncertainty = uncertaintyMap[uncertaintyLevel];
    
    return {
        minLeadTime: parseInt(document.getElementById('minLeadTime').value),
        maxLeadTime: parseInt(document.getElementById('maxLeadTime').value),
        MAX_CAPACITY: parseInt(document.getElementById('maxCapacity').value),
        MAX_DEMAND: parseInt(document.getElementById('maxDemand').value),
        HOLDING_COST: parseFloat(document.getElementById('holdingCost').value),
        STOCKOUT_COST: parseFloat(document.getElementById('stockoutCost').value),
        PURCHASE_COST: parseFloat(document.getElementById('purchaseCost').value),
        FIXED_ORDER_COST: parseFloat(document.getElementById('fixedOrderCost').value),
        baseWeekdayDemand: parseInt(document.getElementById('baseWeekdayDemand').value),
        weekendRatio: parseFloat(document.getElementById('weekendRatio').value),
        demandVariance: uncertainty.variance,
        demandShockProb: uncertainty.shockProb,
        demandPattern: demandPattern,
        horizonDays: parseInt(document.getElementById('horizonDays').value)
    };
}

// Validate configuration
function validateConfig(config) {
    if (config.minLeadTime > config.maxLeadTime) {
        alert('Min Lead Time cannot be greater than Max Lead Time');
        return false;
    }
    return true;
}

// Initialize simulation state
function initializeState(config) {
    const avgLeadTime = Math.floor((config.minLeadTime + config.maxLeadTime) / 2);
    const incoming = new Array(config.maxLeadTime).fill(0);
    
    return {
        day: 0,
        step: 0,
        inventory: config.baseWeekdayDemand * 5, // Start with ~5 days of inventory
        prevDemand: config.baseWeekdayDemand,
        incoming: incoming
    };
}

// Main simulation loop
function runSimulation(initialState, config) {
    let state = { ...initialState, incoming: [...initialState.incoming] };
    const history = [];
    
    for (let t = 0; t < config.horizonDays; t++) {
        // Decide order quantity based on simple policy
        const orderQty = decideOrderQty(state, config);
        
        // Step environment
        const { nextState, record } = stepEnvironment(state, orderQty, config);
        
        // Record history
        history.push(record);
        
        // Update state
        state = nextState;
    }
    
    return history;
}

// Simple policy: target inventory level
function decideOrderQty(state, config) {
    // Target inventory = 7 days of expected demand
    const targetInventory = state.prevDemand * 7;
    
    // Current inventory + incoming orders
    const totalIncoming = state.incoming.reduce((sum, qty) => sum + qty, 0);
    const projectedInventory = state.inventory + totalIncoming;
    
    // Order to reach target
    let orderQty = targetInventory - projectedInventory;
    
    // Minimum order quantity threshold
    if (orderQty < config.baseWeekdayDemand * 0.5) {
        orderQty = 0;
    }
    
    // Cap at max capacity
    orderQty = Math.max(0, Math.min(orderQty, config.MAX_CAPACITY));
    
    return Math.round(orderQty);
}

// Environment step function
function stepEnvironment(state, orderQty, config) {
    const newState = { ...state };
    
    // 1. Process incoming delivery (from pipeline[0])
    const todayIncoming = newState.incoming[0];
    newState.inventory += todayIncoming;
    
    // 2. Shift pipeline left and add new order at the end
    newState.incoming.shift();
    const leadTime = randomInt(config.minLeadTime, config.maxLeadTime);
    
    // Pad pipeline if needed
    while (newState.incoming.length < config.maxLeadTime) {
        newState.incoming.push(0);
    }
    
    // Place order in pipeline
    if (leadTime <= newState.incoming.length && orderQty > 0) {
        newState.incoming[leadTime - 1] += orderQty;
    }
    
    // 3. Generate demand
    const demand = generateDemand(newState, config);
    
    // 4. Process demand and calculate stockout
    const sales = Math.min(demand, newState.inventory);
    const stockout = Math.max(0, demand - newState.inventory);
    newState.inventory = Math.max(0, newState.inventory - demand);
    
    // 5. Cap inventory at max capacity
    newState.inventory = Math.min(newState.inventory, config.MAX_CAPACITY);
    
    // 6. Calculate costs and reward
    const holdingCost = newState.inventory * config.HOLDING_COST;
    const stockoutPenalty = stockout * config.STOCKOUT_COST;
    const variableOrderCost = orderQty * config.PURCHASE_COST;
    const fixedOrderCost = orderQty > 0 ? config.FIXED_ORDER_COST : 0;
    
    const totalCost = holdingCost + stockoutPenalty + variableOrderCost + fixedOrderCost;
    const reward = -totalCost / 100000.0; // Scale down
    
    // 7. Update state
    newState.prevDemand = demand;
    newState.step += 1;
    newState.day = (newState.day + 1) % 7;
    
    // 8. Create record
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

// Generate demand based on config - more realistic with controllable uncertainty
function generateDemand(state, config) {
    const baseWeekday = config.baseWeekdayDemand;
    const weekendRatio = config.weekendRatio;
    
    // 1. Day of week factor (0-6: Mon-Sun, 5-6 = weekend)
    const isWeekend = state.day >= 5;
    const dayFactor = isWeekend ? weekendRatio : 1.0;
    
    // 2. Pattern-based factor
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
            // Random walks - more unpredictable
            if (!state.volatileMultiplier) {
                state.volatileMultiplier = 1.0;
            }
            // Random walk: small changes accumulate over time
            const change = randomUniform(-0.15, 0.15);
            state.volatileMultiplier = Math.max(0.5, Math.min(1.5, state.volatileMultiplier + change));
            patternFactor = state.volatileMultiplier;
            break;
    }
    
    // 3. Base demand calculation
    let baseDemand = baseWeekday * dayFactor * patternFactor;
    
    // 4. Apply uncertainty (main source of randomness)
    // Use normal distribution with configurable variance
    const stdDev = baseDemand * config.demandVariance;
    const randomComponent = randomNormal(0, stdDev);
    let finalDemand = baseDemand + randomComponent;
    
    // 5. Demand shocks (sudden spikes or drops)
    if (Math.random() < config.demandShockProb) {
        // Shock can be positive (spike) or negative (drop)
        const shockMagnitude = randomUniform(1.5, 2.5) * (Math.random() > 0.3 ? 1 : -0.5);
        finalDemand *= shockMagnitude;
    }
    
    // 6. Ensure demand is within reasonable bounds
    finalDemand = Math.max(0, Math.min(finalDemand, config.MAX_DEMAND));
    
    return Math.round(finalDemand);
}

// Compute KPIs from history
function computeKpis(history) {
    const n = history.length;
    
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

// Render chart using Chart.js
function renderChart(history) {
    const ctx = document.getElementById('inventoryChart').getContext('2d');
    
    // Calculate 7-day moving averages
    const windowSize = 7;
    const inventory7d = movingAverage(history.map(r => r.inventory), windowSize);
    const demand7d = movingAverage(history.map(r => r.demand), windowSize);
    const incoming7d = movingAverage(history.map(r => r.incomingAvg), windowSize);
    const order7d = movingAverage(history.map(r => r.orderQty), windowSize);
    
    const labels = history.map(r => r.day);
    
    // Destroy previous chart if exists
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart
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
                    fill: false
                },
                {
                    label: 'Demand (7d MA)',
                    data: demand7d,
                    borderColor: 'rgb(249, 115, 22)',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Avg Incoming (7d MA)',
                    data: incoming7d,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 2,
                    borderDash: [2, 4],
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Order Qty (7d MA)',
                    data: order7d,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    stepped: true,
                    tension: 0,
                    fill: false
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
                    display: true,
                    text: 'Inventory / Demand / Incoming / Order Qty (180 Days)',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
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
                        text: 'Day'
                    },
                    ticks: {
                        maxTicksLimit: 20
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Quantity'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// Render KPI cards
function renderKpis(kpis) {
    document.getElementById('kpiAvgInventory').textContent = kpis.avgInventory.toLocaleString();
    document.getElementById('kpiAvgDemand').textContent = kpis.avgDemand.toLocaleString();
    document.getElementById('kpiTotalStockout').textContent = kpis.totalStockout.toLocaleString();
    document.getElementById('kpiTotalCost').textContent = kpis.totalCost.toLocaleString();
}

// Render daily table (optional, can be toggled)
function renderTable(history) {
    const tableBody = document.getElementById('dailyTableBody');
    tableBody.innerHTML = '';
    
    // Show only first 30 days for performance
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
    
    // Show table container
    // document.getElementById('tableContainer').style.display = 'block';
}

// Utility: Calculate moving average
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

// Utility: Random integer between min and max (inclusive)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Utility: Random uniform between min and max
function randomUniform(min, max) {
    return Math.random() * (max - min) + min;
}

// Utility: Random normal distribution (Box-Muller transform)
function randomNormal(mean, stdDev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
}

