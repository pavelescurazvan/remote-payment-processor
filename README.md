# Remote Payment Processor

A remote payment processor API with a PostgreSQL database.

## Getting Started

### Prerequisites

- Docker
- Docker Compose

### Running the Application

To start the entire stack (API, Database, and Migrations), run:

```bash
docker-compose up --build
```

The API will be available at `http://localhost:8080`.

### Healthcheck

You can verify that the API is running by visiting:
`http://localhost:8080/healthcheck`

### Database

The database is exposed on port `5432` on the host machine.

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `pay_pro`

## Development

### API

The API is located in the `api/` directory.

```bash
cd api
npm install
npm run dev
```

### Database Migrations

Migrations are handled in the `db/` directory using Sqitch.
