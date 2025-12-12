# Backend - Import/Export Platform

Flask + PostgreSQL + Groq AI

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Environment Variables

Create a `.env` file:

```
DATABASE_URL=postgresql://localhost:5432/import_export
JWT_SECRET_KEY=your-secret-key
GROQ_API_KEY=your-groq-api-key
```

## Run

```bash
flask run --port 5001
```

## API Docs

See `/api/docs` when running in development mode.
