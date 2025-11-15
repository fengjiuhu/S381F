# COMP3810 CD Borrowing Web App

## 1. Project Info
- **Project name:** CD Borrowing Desk
- **Group:** Demo Group (replace with your information)
- **Members:** (add your names and student IDs here)

This project delivers a complete borrowing workflow for compact discs. Administrators can curate the CD catalogue and oversee every loan, while regular members browse the library, borrow discs for 30 days, renew once, and return them through the web UI. The application runs on a bundled, dependency-free Express-like stack so it can execute on Render without provisioning databases or installing packages. All data is stored locally as JSON files and seeded with a starter catalogue plus the default admin login.

## 2. Project File Intro
- **server.js** – boots the Express-like server, seeds the default admin account and sample CDs, and exposes the JSON API that powers the web experience.
- **package.json** – contains project metadata and npm scripts (`npm start`). No third-party downloads are required because the minimal runtime helpers live inside the repository.
- **public/index.html** – the single-page application shell that renders the entire interface.
- **public/app.js** – vanilla JavaScript SPA logic handling authentication, navigation, and CRUD flows.
- **public/styles.css** – shared styling for both the login form and authenticated views.
- **models/** – JSON-backed data helpers (`User.js`, `CD.js`, `Loan.js`) that persist information to files in `data/` at runtime.
- **lib/** – handcrafted implementations of the necessary middleware (`express`, `express-session`, `method-override`, `morgan`, `dotenv`). They mirror the APIs used in this coursework while avoiding external installations.

Feel free to add optional folders (e.g., `routes/`, `tests/`) if you extend the project later.

## 3. Cloud-based Server URL
Deploy the app to Render (or any Node.js hosting service) and update this section with your live URL, for example:
```
https://comp3810-cd-borrowing.onrender.com
```
The bundled stack works on Render without extra configuration. Just push the repository and set the start command to `npm start`.

## 4. Operation Guides

### Login / Logout / Registration Flow
1. Visit the site root (`/`) and either register a new member account or sign in with existing credentials.
   - The seeded administrator account is `admin` / `admin`.
2. Registration collects a username, password (with confirmation), full name, and email so loans can record borrower details.
3. After authentication the app lands on the dashboard (admins) or library (members).
4. Use the **Logout** button in the top navigation to end your session.

### In-app Navigation
- **Dashboard** *(admin)* – overview of inventory statistics and recently catalogued CDs.
- **Manage CDs** *(admin)* – search, add, edit, delete, and borrow CDs on behalf of patrons with live loan status badges.
- **All Loans** *(admin)* – monitor active loans, check due dates, and mark discs as returned.
- **Library** *(member)* – browse the catalogue, view availability and due dates, and borrow or renew discs directly.
- **My Loans** *(member)* – track personal loans, return discs, and use the one-time renewal.
- **Account** *(member)* – view profile details and a quick loan summary.

### RESTful CRUD Services
All API routes require an authenticated session (log in first).
- `POST /api/login` – start a session (JSON body: `username`, `password`).
- `POST /api/register` – create a member account and begin a session (JSON body: `username`, `password`, `confirm`, `displayName`, `email`).
- `POST /api/logout` – destroy the current session.
- `GET /api/session` – retrieve the authenticated user.
- `GET /api/dashboard` – aggregate inventory statistics (admin only).
- `GET /api/cds` – list all CDs (admin view).
- `GET /api/cds/:id` – fetch a single CD (admin view).
- `POST /api/cds` – create a CD (admin only, JSON body: `title`, `artist`, `genre`, `year`, `totalCopies`).
- `PUT /api/cds/:id` – update a CD (admin only, JSON body contains fields to update).
- `DELETE /api/cds/:id` – delete a CD and its associated loans (admin only).
- `GET /api/library` – library overview with active loan metadata for each CD (all users).
- `POST /api/cds/:id/borrow` – record a borrowing event; members borrow for themselves, admins can supply borrower details.
- `GET /api/loans` – list loans (admins see every loan, members only see their own).
- `POST /api/loans/:id/return` – mark a loan as returned and restock copies (admins or the owning member).
- `POST /api/loans/:id/renew` – extend an active loan by 30 days (once per loan, admins or the owning member).

### Testing the App Locally
```
npm start
```
Then visit `http://localhost:3000` in your browser. When running locally, data persists to the `data/` folder. Delete that folder to reset the database.

The local JSON "database" seeds the following records on first boot:
- Administrator account `admin` / `admin`
- Three example CDs (`Greatest Hits`, `Jazz Essentials`, `Coding Focus`) so the library view is populated immediately.

Add automated tests if needed. Manual testing steps and screenshots can be documented here for grading.
