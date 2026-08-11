# Booking Hub

Backend foundation for Booking Hub.

## Local setup

1. Copy `.env.example` to `.env`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm run start:dev
   ```

## API

- Swagger: `/docs`
- Health check: `/api/v1/health`
- Base path: `/api/v1`

## Notes

- The API runs without database dependencies in the MVP.
- Global validation and exception handling are enabled.
- CORS is explicitly enabled.
