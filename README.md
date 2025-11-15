# COMP3810 CD Borrowing Web App

## 1. Project Info
- **Project name:** CD Borrowing Desk
- **Group:** Demo Group (replace with your information)
- **Members:** (add your names and student IDs here)

This project delivers a complete borrowing workflow for compact discs. Staff members can manage their CD inventory, issue discs to patrons, and track returns via both web UI and RESTful APIs. The application runs with the provided lightweight Express/Mongoose compatible stack so it can execute on Render without extra services.

## 2. Project File Intro
- **server.js** – boots the Express server, wires middleware, seeds the default admin account, defines page routes, and exposes the RESTful API endpoints.
- **package.json** – contains project metadata and npm scripts (`npm start`). No third-party downloads are required because the minimal runtime libraries are bundled under `node_modules`.
- **views/** – EJS templates for each page (`layout.ejs`, `login.ejs`, `dashboard.ejs`, and the CD/Loan subfolders).
- **public/** – static assets such as `styles.css` for the user interface.
- **models/** – data schemas implemented with the embedded mongoose-compatible layer (`User.js`, `CD.js`, `Loan.js`). Data is persisted in JSON files inside `data/` at runtime.
- **node_modules/** – handcrafted implementations of the required libraries (`express`, `express-session`, `mongoose`, `ejs`, `method-override`, `morgan`, `dotenv`). They mirror the APIs used in this coursework while avoiding external installations.

Feel free to add optional folders (e.g., `routes/`, `tests/`) if you extend the project later.

## 3. Cloud-based Server URL
Deploy the app to Render (or any Node.js hosting service) and update this section with your live URL, for example:
```
https://comp3810-cd-borrowing.onrender.com
```
The bundled stack works on Render without extra configuration. Just push the repository and set the start command to `npm start`.

## 4. Operation Guides

### Login / Logout Flow
1. Visit `/login` and sign in with the seeded admin account (`admin` / `admin123`).
2. After authentication you are redirected to the dashboard.
3. Use the **Logout** link in the top navigation to end your session.

### CRUD Web Pages
- **Dashboard (`/`)** – overview of inventory statistics and recently catalogued CDs.
- **CD Library (`/cds`)** – search, view, edit, and delete CDs. Adding a CD automatically sets available copies.
- **CD Detail (`/cds/:id`)** – inspect a CD, record a new loan, or review its loan history.
- **Loans (`/loans`)** – mark borrowed CDs as returned.
- **Loan History (`/loans/history`)** – read-only archive of every loan event.

### RESTful CRUD Services
All API routes require an authenticated session (log in first).
- `GET /api/cds` – list all CDs (HTTP GET).
- `GET /api/cds/:id` – fetch a single CD (HTTP GET).
- `POST /api/cds` – create a CD (HTTP POST, JSON body: `title`, `artist`, `genre`, `year`, `totalCopies`).
- `PUT /api/cds/:id` – update a CD (HTTP PUT, JSON body contains fields to update).
- `DELETE /api/cds/:id` – delete a CD and its associated loans (HTTP DELETE).

### Testing the App Locally
```
npm start
```
Then visit `http://localhost:3000` in your browser. When running locally, data persists to the `data/` folder. Delete that folder to reset the database.

Add automated tests if needed. Manual testing steps and screenshots can be documented here for grading.
