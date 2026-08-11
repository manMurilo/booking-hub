# Booking Hub

Backend foundation for Booking Hub.

## Local setup

1. Copy `.env.example` to `.env`
2. Start PostgreSQL with Docker Compose:
   ```bash
   docker compose up -d
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
5. Run migrations:
   ```bash
   npm run prisma:migrate:dev
   ```
6. Start the app:
   ```bash
   npm run start:dev
   ```

## API

- Swagger: `/docs`
- Health check: `/api/v1/health`
- Base path: `/api/v1`

## Notes

- PostgreSQL is configured via Prisma and Docker Compose.
- Global validation and exception handling are enabled.
- CORS is explicitly enabled.
