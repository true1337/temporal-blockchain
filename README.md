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
├── ddl/              # ClickHouse DDL files
└── config.ts         # Configuration loader
```

## Configuration

- `config.json` - Wallet and contract addresses
- `.env` - Environment variables (TEMPORAL_ADDRESS, CLICKHOUSE_URL)


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
- **Impact**: 
  - Cannot pass large arrays of events directly from activity to workflow
  - Must save data in smaller batches (currently 500 events per batch)
  - Adds complexity to batch processing logic
- **Current Solution**: 
  - Events are saved to ClickHouse in batches of 500 within the activity
  - Workflow only tracks progress (block numbers), not event data
- **Potential Improvements**:
  - Use Temporal's `continueAsNew` more frequently to reset history size
  - Consider using external storage (S3, database) for large payloads
  - Implement streaming/chunking at the activity level
  - Increase message size limit in Temporal configuration (requires server-side changes)
- **Status**: Workaround implemented, but limits batch processing efficiency.