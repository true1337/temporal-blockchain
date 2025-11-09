-- 1. Daily gas costs (in ETH)
SELECT 
    toDate(timestamp) as date,
    from_address as address,
    sum(receipt_gas_used * toUInt64(receipt_effective_gas_price)) / 1e18 as gas_cost_eth,
    sum(receipt_gas_used * toUInt64(receipt_effective_gas_price)) as gas_cost_wei
FROM debridge.usdc_transactions
WHERE from_address = '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'
GROUP BY date, address
ORDER BY date

-- 2. 7-day moving average (MA7) for effective gas price
WITH daily_avg_gas_price AS (
    SELECT 
        toDate(timestamp) as date,
        avg(toUInt64(receipt_effective_gas_price)) as avg_gas_price_wei
    FROM debridge.usdc_transactions
    WHERE from_address = '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'
    GROUP BY date
)
SELECT 
    date,
    avg(avg_gas_price_wei) OVER (
        ORDER BY date 
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as ma7_wei,
    ma7_wei / 1e9 as ma7_gwei
FROM daily_avg_gas_price
ORDER BY date

-- 3. Cumulative gas cost
WITH daily_gas_cost AS (
    SELECT 
        toDate(timestamp) as date,
        sum(receipt_gas_used * toUInt64(receipt_effective_gas_price)) / 1e18 as daily_gas_cost_eth
    FROM debridge.usdc_transactions
    WHERE from_address = '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'
    GROUP BY date
)
SELECT 
    date,
    sum(daily_gas_cost_eth) OVER (
        ORDER BY date 
        ROWS UNBOUNDED PRECEDING
    ) as cum_eth
FROM daily_gas_cost
ORDER BY date

-- 4. Complete metrics summary for address
SELECT 
    from_address as address,
    count() as events_collected,
    min(block_number) as blocks_scanned_start,
    max(block_number) as blocks_scanned_end,
    min(toDate(timestamp)) as period_start,
    max(toDate(timestamp)) as period_end,
    sum(receipt_gas_used * toUInt64(receipt_effective_gas_price)) / 1e18 as total_gas_cost_eth
FROM debridge.usdc_transactions
WHERE from_address = '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'
GROUP BY address

-- 5. Combined query with all metrics (similar to analyzeBatch)
WITH daily_metrics AS (
    SELECT 
        toDate(timestamp) as date,
        from_address as address,
        count() as events_collected,
        sum(receipt_gas_used * toUInt64(receipt_effective_gas_price)) as gas_cost_wei,
        sum(receipt_gas_used * toUInt64(receipt_effective_gas_price)) / 1e18 as gas_cost_eth,
        avg(toUInt64(receipt_effective_gas_price)) as avg_effective_gas_price
    FROM debridge.usdc_transactions
    WHERE from_address = '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'
    GROUP BY date, address
),
ma7_data AS (
    SELECT 
        date,
        address,
        gas_cost_wei,
        gas_cost_eth,
        avg(avg_effective_gas_price) OVER (
            PARTITION BY address
            ORDER BY date 
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) as ma7_wei
    FROM daily_metrics
)
SELECT 
    date,
    address,
    gas_cost_wei,
    gas_cost_eth,
    ma7_wei,
    ma7_wei / 1e9 as ma7_gwei,
    sum(gas_cost_eth) OVER (
        PARTITION BY address
        ORDER BY date 
        ROWS UNBOUNDED PRECEDING
    ) as cum_eth
FROM ma7_data
ORDER BY date

