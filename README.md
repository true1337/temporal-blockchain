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