# Development Challenges

## Problems Faced During Backend Development

### 1. Understanding Requirements and Mapping Services

* The first challenge was understanding the constraints given in the assignment and mapping the expected services and functionality to actual backend code.
* I had to break down the requirements into different backend responsibilities such as ticket processing, job management, schema validation, concurrency control, human review, and CSV export.

### 2. Data Storage and State Management

* One challenge was deciding how to store the data effectively while keeping the server responsive.
* Since a database was not required, I opted to use Python dictionaries for most of the in-memory data storage.
* Although dictionaries made the implementation simple and fast, managing different states of the data became challenging.
* The backend had to distinguish between successfully processed records, records requiring human review, failed records, and running jobs.

### 3. Schema Validation

* Another major challenge was handling schema validation for AI-generated responses.
* The AI output had to follow a strict Pydantic schema before it could be considered valid.
* Handling different types of processed tickets was challenging because successful records and records requiring human review had different data structures.
* I used separate Pydantic models to represent the different types of data and validate them before storing or returning them.

### 4. Limiting AI Concurrency

* Processing a large number of tickets simultaneously can result in an impractical number of AI requests.
* To prevent unlimited concurrent AI calls, I introduced a `MAX_WORKERS` environment variable.
* An `asyncio.Semaphore` is used to control the number of AI processing tasks that can run concurrently.
* This allowed the concurrency limit to be configurable without changing the application code.

### 5. CSV File Generation

* Initially, generating CSV exports involved creating files on the server, which could result in multiple unnecessary files accumulating over time.
* This would have been a poor design decision because temporary export files do not need to persist after the response is returned.
* I changed the implementation to use temporary files instead.
* The temporary file is deleted after the file response is completed, preventing unnecessary files from remaining on the server.

## Problems Faced During Frontend Development

### 1. Handling API Requests and Responses

* Frontend development was comparatively less challenging than the backend.
* One issue was handling API calls correctly and making sure the frontend processed the responses according to the backend API structure.
* Another important part was ensuring that the frontend sent valid data when creating or updating records.

### 2. Handling Different Record Structures

* The backend returns different response structures depending on the state of a record.
* Handling all these different types of records correctly on the frontend was an important challenge.
* I created separate dynamic routes to handle the different record states.

### 3. Successful Records

* The `/records/[id]` route is responsible for displaying successfully processed records.
* It displays the extracted information and allows the user to review or modify the extracted fields.

### 4. Records Requiring Human Review

* The `/review/[id]` route handles records where the AI failed to parse the response correctly or was not sufficiently confident in the extracted information.
* This route displays both the original ticket and the AI-generated output so that the user can manually review and correct the information.
* This separation made it easier to handle successful records and records requiring human intervention independently.
