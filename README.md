# Ethereum Transfer Events Exporter

Export Transfer events from Ethereum blockchain to ClickHouse using Temporal workflows.

## Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Temporal** - Workflow orchestration
- **ClickHouse** - Analytical database
- **viem** - Ethereum library

## Prerequisites

- Node.js 18+
- Docker & Docker Compose

## Quick Start

1. **Start services:**
```bash
docker-compose up -d
```

2. **Configure:**
   - Copy `config.example.json` to `config.json` and fill in addresses
   - Create `.env` file:
     ```
     TEMPORAL_ADDRESS=localhost:7233
     CLICKHOUSE_URL=http://localhost:8123
     ```

3. **Install dependencies:**
```bash
npm install
```

4. **Run:**
   - Terminal 1: `npm run worker`
   - Terminal 2: `npm run start-workflow`

## Services

- **Temporal UI**: http://localhost:8088
- **ClickHouse UI**: http://localhost:18080

## Project Structure

```
src/
├── temporal/          # Temporal workflows and activities
│   ├── activities/   # Temporal activities (side-effect operations)
│   └── shared/       # Shared utilities for activities (retry, ethereum client, DDL loader)
├── ddl/              # ClickHouse DDL files and example queries
└── config.ts         # Configuration loader from config.json and .env
```

## Configuration

- `config.json` - Wallet and contract addresses
- `.env` - Environment variables (TEMPORAL_ADDRESS, CLICKHOUSE_URL)

## Tasks

### Data Processing
- ✅ **Correctly handle pagination / block ranges, retries, and rate limits** - Implemented exponential backoff with jitter for RPC calls, block range pagination (1000 blocks per request), and automatic retry logic
- ❌ **Currency rates fetching**

### Idempotency
- ⚠️ **Ensure idempotency (no duplicates when re-running the pipeline)** - Partially implemented using Temporal's deterministic workflow state, but relies on ReplacingMergeTree for deduplication which is not immediate


### Data Analysis
- ✅ **Data analysis** - Implemented

### Storage
- ✅ **ClickHouse + indexes on timestamps and addresses** - Implemented with proper table structure and indexes

### Infrastructure
- ✅ **docker-compose** - Implemented with Temporal and ClickHouse services

### Monitoring
- ❌ **Monitoring** - Not implemented yet

## TODO

- Think about idempotency
- Implement database module, remove hardcoded DDL
- Implement tests
- Prettify `workflow.ts`, looks overloaded
- little confidence that everything will work the way I want it to :D
- Think of corner cases 

## Thoughts 

#### 1. ReplacingMergeTree
- **Issue**: According to ClickHouse documentation, `ReplacingMergeTree` does not guarantee deduplication. Merging happens 
asynchronously in the background, and duplicates may exist until the merge occurs.
- **Status**: Not reliable enough for critical data.

#### 2. Partition Overwrite (DROP PARTITION + INSERT)
- **Issue**: If partitioning by block ranges (e.g., 100000 blocks), partitions will be very small 
for small query ranges. This can lead to:
  - Large number of small partitions
  - Inefficient disk space usage
  - Complexity in partition management
- **Status**: Requires experimentation with partition size and optimization.

#### 3. Temporal 4MB Message Size Limit
- **Issue**: Temporal has a default message size limit of 4MB for workflow history and activity results. 
When processing large batches of events, passing all events through workflow state can exceed this limit.
- **Example**: 2500 events from 10,000 blocks exceed the default message size by ~7x (approximately 28MB vs 4MB limit)
- **Impact**: 
  - Cannot pass large arrays of events directly from activity to workflow
  - Requires optimization to reduce data size
- **Current Solution**: 
  - Workaround: removed fields not used in analysis from the table
  - Kept only necessary fields: keys (block_number, transaction_hash) and fields for data analysis (from_address, to_address, timestamp, receipt_gas_used, receipt_effective_gas_price)
  - This reduced data size and allowed passing more events through Temporal
  - Workflow only tracks progress (block numbers), not event data
- **Additional Workaround**:
  - Reduced batchSize to minimum (1000 blocks), which triggers writes more frequently
  - This helps but doesn't fully solve the problem for dense block ranges
- **Possible Solution**:
  - Perform database writes not as a separate activity, but immediately after fetching events within the fetch activity
  - This would avoid passing events through Temporal workflow state entirely
- **Potential Improvements**:
  - Use Temporal's `continueAsNew` more frequently to reset history size
  - Implement streaming/chunking at the activity level
  - Increase message size limit in Temporal configuration (requires server-side changes)
- **Status**: Workaround implemented, but limits batch processing efficiency.