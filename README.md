# Extraction Workbench

A human-review tool for extracting structured information from customer support tickets using FastAPI, Next.js, and Gemini.

## Requirements

Make sure the following are installed:

* Python 3.10+
* Node.js and npm, or Bun
* Git
* Gemini API key


## Clone the Repository

Clone the backend repository:

```bash
git clone https://github.com/pratyaksh1001/oraczen-backend.git
cd oraczen-backend
```

The repository contains both the FastAPI backend and the Next.js frontend:

```text
oraczen-backend/
├── main.py
├── models.py
├── requirements.txt
├── data/
└── frontend/
```

## Backend Setup

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file in the backend root directory:

```env
GEMINI_API_KEY=your_gemini_api_key

UNCERTAINTY_NUMBER=1
MAX_WORKERS=2
```

Replace `your_gemini_api_key` with your Gemini API key.

Start the FastAPI server:

```bash
fastapi run main.py
```

The backend will run on:

```text
http://localhost:8000
```

## Frontend Setup

Open a new terminal and switch to the frontend directory:

```bash
cd frontend
```

### Using npm

Install the dependencies:

```bash
npm install
```

Build the frontend:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

The frontend will run on:

```text
http://localhost:3000
```

### Using Bun

Alternatively, you can use Bun:

```bash
bun i
```

Build the application:

```bash
bun run build
```

Start the production server:

```bash
bun run start
```

The frontend will run on:

```text
http://localhost:3000
```

## Environment Variables

The backend requires the following environment variables:

```env
GEMINI_API_KEY=your_gemini_api_key

UNCERTAINTY_NUMBER=1
MAX_WORKERS=2
```

| Variable             | Description                                                                                                 |
| -------------------- |-------------------------------------------------------------------------------------------------------------|
| `GEMINI_API_KEY`     | Gemini API key used for structured ticket extraction                                                        |
| `UNCERTAINTY_NUMBER` | A number that determines how many uncertain values are required in a response to require human verification |
| `MAX_WORKERS`        | Maximum number of AI workers that process tickets concurrently                                              |

## Running the Application

Start the backend first:

```bash
fastapi run main.py
```

Then, in a separate terminal:

```bash
cd frontend
npm install
npm run build
npm run start
```

The application will then be available at:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:8000
```

## Tech Stack

### Backend

* Python
* FastAPI
* Pydantic
* Gemini API

### Frontend

* Next.js
* React
* TypeScript
* npm / Bun

## Notes on data loss after fastAPI server shuts down

The application uses in-memory state for job and review information. Data stored in memory is lost when the backend process is restarted.
After the restart only the ticket data will remain as it is read from the JSONL file.
