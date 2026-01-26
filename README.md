# Remote Payment Processor

A remote payment processor with a PostgreSQL database.

## Getting Started

### Prerequisites

- Docker
- Docker Compose

### Running the Application

To start the entire stack (Payment Processor, Database, and Migrations), run:

```bash
docker-compose up --build
```

### Database

The database is exposed on port `5432` on the host machine.

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `pay_pro`

## Development

### Payment Processor

The payment processor is located in the `server/` directory.

```bash
cd server
npm install
npm run dev
```

### Database Migrations

Migrations are handled in the `db/` directory using Sqitch.
