# Remote Payment Processor

A payment processing engine that reads transactions from a CSV file, processes deposits, withdrawals, disputes, resolves, and chargebacks, and outputs client account states.

## Prerequisites

- **Docker** - For running PostgreSQL database
- **Docker Compose** - For orchestrating containers
- **Node.js** (v16 or higher) - For running the TypeScript application
- **npm** - For package management

## Getting Started

### 1. Start Database and Migrations

First, start the PostgreSQL database and run migrations using Docker Compose:

```bash
docker-compose up -d
```

This will:
- Start a PostgreSQL database on `localhost:5432`
- Run database migrations automatically
- Set up the `pay_pro` schema and event store

### 2. Install Dependencies

Navigate to the server directory and install dependencies:

```bash
cd server
npm install
npm run build
```

### 3. Run the Application

Process a CSV file by providing it as the first argument:

```bash
npm run dev ../input.csv > output.csv
```

```bash
node dist/index.js ../input.csv > output.csv
```

Or with a custom path:

```bash
npm run dev /path/to/transactions.csv > output.csv
```

```bash
node dist/index.js /path/to/transactions.csv > output.csv
```

This will:
- Stream transactions from the specified CSV file
- Process all transactions sequentially in chronological order (deposits, withdrawals, disputes, resolves, chargebacks)
- Output client account states in CSV format to the console

**Expected Output Format:**
```
client, available, held, total, locked
1, 134.775, 0, 134.775, false
2, 165.75, 0, 165.75, true
...
```

## Running Tests

Run the integration test suite:

```bash
npm test
```

Tests include:
- CSV validation
- Transaction processing (deposits, withdrawals, disputes, resolves, chargebacks)
- Edge cases (idempotency, decimal precision)
- Full end-to-end processing

## Project Structure

```
.
├── input.csv              # Input CSV with transactions
├── server/
│   ├── src/
│   │   ├── domain/        # Business logic and transaction processing
│   │   ├── repository/    # Database access layer
│   │   ├── utils/         # CSV parsing and validation
│   │   └── tests/         # Integration tests
│   └── package.json
├── db/                    # Database migrations (Sqitch)
└── docker-compose.yml     # Docker setup for PostgreSQL
```

## How It Works

1. **Input**: Reads CSV file with columns: `type, client, tx, amount`
   - `client` - Valid u16 client ID (0-65535)
   - `tx` - Valid u32 transaction ID (0-4294967295)
   - `amount` - Decimal value with precision up to 4 decimal places
2. **Processing**: Handles transaction types:
   - `deposit` - Credits client account
   - `withdrawal` - Debits client account
   - `dispute` - Holds funds for disputed transaction
   - `resolve` - Releases held funds
   - `chargeback` - Reverses transaction and locks account
3. **Output**: Displays client account states with:
   - `available` - Funds available for withdrawal
   - `held` - Funds held due to disputes
   - `total` - Total funds (available + held)
   - `locked` - Account locked due to chargeback

## Database

The PostgreSQL database is exposed on:

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `pay_pro`

## Architecture

- **Event Sourcing with Materialized State**: All transactions are stored as immutable events in an append-only event store
- **Cumulative Ledger**: Each new event computes and stores the cumulative state (`available`, `held`, `total`, `locked`) based on the previous event, like a ledger
- **Efficient Reads**: To retrieve the current state of a client's account, only the last event needs to be read (no replaying required)
- **Sequential Processing**: Transactions are processed sequentially (one at a time) to ensure chronological ordering and maintain consistency. Each CSV transaction is treated as a *mission-critical task* that must be executed in the exact order it appears in the file
- **Streaming Architecture**: CSV records are streamed through memory rather than loaded upfront, enabling efficient processing of large files while maintaining sequential execution guarantees
- **Concurrency Control**: Database-level constraints protect against race conditions:
  - `UNIQUE (client, version)` - Prevents duplicate versions for the same client, ensuring version monotonicity even if multiple processes attempt concurrent writes
  - `UNIQUE (client, tx, type)` - Ensures transaction idempotency, preventing duplicate transaction processing
  - The application is designed for single-process sequential execution, but database constraints provide a safety net against accidental concurrent access
- **Event Store**: PostgreSQL table with unique constraint on (client, tx) for idempotency
- **Idempotency**: Duplicate transaction IDs are ignored due to unique constraint
- **Precision**: All amounts use 4 decimal place precision (stored as integers, e.g., 10000 = 1.0000)

## Use of AI Declaration

**AI Assistance:**
- Claude Agent was used to write streamer, parser, converting user input into fixed-precision integers (scaled by 10000) with strict validation precision and conversion handling, tests and documentation

**Important Note:**
- Application design, coding patterns, business logic, architectural decisions, and database design were created and written by the project author
