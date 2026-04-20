========================================================================
  SIMUCAST — LOCAL SETUP GUIDE
========================================================================

SimuCast is a web-based statistical analysis and predictive modeling
platform (SPSS-lite with AI features). This document explains how to
run it on your own computer.

Follow sections 1-4 in order on your first setup. After that, you only
need section 4 every time you want to run the app.


------------------------------------------------------------------------
  TABLE OF CONTENTS
------------------------------------------------------------------------

  1. What you need before starting
  2. Project folder structure
  3. First-time setup
        3a. Backend (Python)
        3b. Frontend (Node.js)
        3c. Environment variables (API key)
  4. Running the app (do this every time)
  5. First time using SimuCast
  6. Stopping and restarting
  7. Troubleshooting
  8. Who to ask for help


------------------------------------------------------------------------
  1. WHAT YOU NEED BEFORE STARTING
------------------------------------------------------------------------

Install these BEFORE you start setup:

  [ ] Python 3.10 or newer (we tested on 3.13).
      Download from: https://www.python.org/downloads/
      IMPORTANT when installing: check the box
      "Add Python to PATH" or you'll have problems later.

  [ ] Node.js 18 or newer.
      Download from: https://nodejs.org/
      The "LTS" version is what you want.

  [ ] A code editor (recommended: VS Code).
      Not strictly required, but very helpful for editing config files.
      https://code.visualstudio.com/

  [ ] The SimuCast project folder.
      Get this from Vanta (zip, USB, Google Drive, whatever).
      Extract it somewhere easy to find, like:
        C:\Users\YourName\Documents\simucast
      (or wherever you like — the path doesn't matter as long as
      you can navigate to it in a terminal.)

  [ ] An Anthropic API key.
      You either need your own (see section 3c) or Vanta can share
      the team's .env file with you. Without an API key, most things
      still work but the AI chat, AI interpretations, AI-generated
      synthetic data, and AI feature suggestions will all fail.

To check what's installed, open PowerShell (Windows) or Terminal (Mac)
and run:

    python --version
    node --version
    npm --version

All three should print version numbers. If any of them say
"command not found" or "not recognized", go install that one.


------------------------------------------------------------------------
  2. PROJECT FOLDER STRUCTURE
------------------------------------------------------------------------

After extracting the project, you should see this inside:

    simucast/
        backend/           <-- Python code (Flask + AI + stats)
            app.py
            requirements.txt
            routes/
            services/
            .env.example   <-- template for your env file
        frontend/          <-- React code (the UI)
            package.json
            src/
            vite.config.js
        README.txt         <-- this file

If the folder doesn't look like this, something is wrong with what
you were given. Ask Vanta.


------------------------------------------------------------------------
  3. FIRST-TIME SETUP
------------------------------------------------------------------------

You only have to do this ONCE. After this, you just run the app
(section 4).

Open PowerShell (Windows) or Terminal (Mac/Linux). Navigate to the
simucast folder:

    cd C:\Users\YourName\Documents\simucast

(Use whatever path you extracted to.)


------------------------------------------------------------------------
  3a. BACKEND SETUP (Python)
------------------------------------------------------------------------

From the simucast folder, go into backend:

    cd backend

Create a Python virtual environment. A venv is just an isolated Python
install for this project, so our dependencies don't conflict with any
other Python stuff on your computer:

    python -m venv .venv

Activate the venv. Which command depends on your OS:

    Windows PowerShell:
        .\.venv\Scripts\Activate.ps1

    Windows Command Prompt (cmd):
        .\.venv\Scripts\activate.bat

    Mac / Linux:
        source .venv/bin/activate

You'll know it worked if your prompt changes to show "(.venv)" at
the beginning.

IF ACTIVATION FAILS on PowerShell with an error about "execution policy"
run this ONCE in PowerShell as Administrator:

    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

Then try activating again.

Now install Python dependencies (this might take 2-5 minutes):

    pip install -r requirements.txt

You should see a bunch of packages downloading and installing. When
it finishes, you're done with backend dependencies.

NOTE: if you get an error about "No module named 'pip._vendor...'"
(corrupted pip), run this to repair pip:

    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python get-pip.py --force-reinstall
    pip install -r requirements.txt

Then delete get-pip.py (you won't need it again).


------------------------------------------------------------------------
  3b. FRONTEND SETUP (Node.js)
------------------------------------------------------------------------

Open a SECOND terminal window. In this one, go to the frontend folder:

    cd C:\Users\YourName\Documents\simucast\frontend

Install Node.js dependencies (this will take 2-5 minutes and download
a few hundred MB):

    npm install

When it finishes, you'll see a new node_modules folder inside
frontend/. That's normal. It's huge. Don't touch it.


------------------------------------------------------------------------
  3c. ENVIRONMENT VARIABLES (API KEY)
------------------------------------------------------------------------

In the backend folder, you need a file called exactly ".env" (note
the leading dot). It holds secrets like the API key and a session
encryption key.

OPTION A — Vanta gives you the team's .env file.
  Just drop it inside the backend/ folder and you're done.

OPTION B — You set it up yourself.

  Step 1: Copy the template.
    In the backend folder:

        copy .env.example .env          (Windows)
        cp .env.example .env            (Mac/Linux)

  Step 2: Open .env in a text editor (VS Code, Notepad, etc).
    It looks something like this:

        ANTHROPIC_API_KEY=your_key_here
        SECRET_KEY=change_this_to_a_random_string

  Step 3: Get an Anthropic API key.
    - Go to https://console.anthropic.com/
    - Sign up (free)
    - Add payment info and at least $5 in credits
    - Go to "API Keys", create a new key
    - Copy the key (starts with "sk-ant-...")

    Paste it into .env replacing "your_key_here":

        ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx

  Step 4: Change SECRET_KEY to a random string. Anything works.
    Example:

        SECRET_KEY=asdf1234qwerty5678mybigrandomsecret

  Step 5: Save the file.

WARNING: never commit the .env file to git, share it publicly, or
post it in screenshots. It contains your API key.


------------------------------------------------------------------------
  4. RUNNING THE APP (every time you want to use it)
------------------------------------------------------------------------

SimuCast has two pieces that both need to run at the same time in
SEPARATE terminal windows:
  - Backend  (Python/Flask)   on port 5000
  - Frontend (React/Vite)      on port 5173

If you close either one, the app stops working.

---

TERMINAL 1 — Start the backend:

    cd C:\Users\YourName\Documents\simucast\backend

Activate the venv (same command as in setup):

    Windows PowerShell:  .\.venv\Scripts\Activate.ps1
    Windows cmd:         .\.venv\Scripts\activate.bat
    Mac / Linux:         source .venv/bin/activate

Run the server:

    python app.py

You should see output ending with something like:

    * Running on http://127.0.0.1:5000
    * Press CTRL+C to quit

Leave this terminal window OPEN. If you close it, the backend stops.

---

TERMINAL 2 — Start the frontend:

    cd C:\Users\YourName\Documents\simucast\frontend
    npm run dev

You should see output ending with something like:

    VITE v5.x.x  ready in xxx ms
    ➜  Local:   http://localhost:5173/

Leave this terminal OPEN too.

---

Now open your web browser (Chrome, Firefox, Edge — not IE) and go to:

    http://localhost:5173

The SimuCast login page should appear.


------------------------------------------------------------------------
  5. FIRST TIME USING SIMUCAST
------------------------------------------------------------------------

Once the login page loads:

  1. Click "Sign up" and create an account. Use any email and password
     you like — this is a local install, nothing gets sent anywhere.
     Example: groupmate1@test.com / password123

  2. After signing up (or logging in), you're on the Dashboard.
     Click "Create new project". Give it any name.

  3. Inside the project, you land on the Data module. You can:
        - Upload a CSV (Vanta can give you dirty_test_data.csv to play
          with — it's a demo dataset with ~500 rows and ~100 columns)
        - Or click "Generate synthetic data" to make one from scratch

  4. Explore the left sidebar — Clean, Expand, Stats, Tests, Model,
     What-if, Report. Each module has tabs and tools inside.

  5. The orange chat panel on the right is the AI assistant. You can
     ask it questions about your data.

For a complete feature walkthrough, ask Vanta for the QA Test Plan
document — it has step-by-step instructions for every feature.


------------------------------------------------------------------------
  6. STOPPING AND RESTARTING
------------------------------------------------------------------------

To STOP the app:
  In each terminal, press Ctrl+C.
  The servers shut down. Close the terminal windows if you want.

To RESTART later:
  Just do section 4 again. You don't need to redo setup.

To restart AFTER your computer restarts:
  Same thing — section 4.

Your projects, uploaded files, and trained models are saved on disk
in backend/uploads/ and a SQLite database file. They persist between
restarts.


------------------------------------------------------------------------
  7. TROUBLESHOOTING
------------------------------------------------------------------------

PROBLEM: "python is not recognized"
  You didn't install Python, OR you forgot to check "Add to PATH".
  Reinstall Python and tick the box.

PROBLEM: "npm is not recognized" or "node is not recognized"
  Install Node.js from https://nodejs.org/

PROBLEM: PowerShell says "cannot be loaded because running scripts is
disabled on this system"
  Run PowerShell as Administrator and execute:
      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  Type Y to confirm. Close PowerShell, open a new one.

PROBLEM: "address already in use" when starting backend (port 5000)
  Something else is using port 5000. Common culprit on Mac: AirPlay
  Receiver (turn it off in System Preferences > Sharing).
  On Windows: find what's using the port and close it:
      netstat -ano | findstr :5000
  Or restart your computer.

PROBLEM: Frontend loads but shows "Network Error" when you try to
do anything
  The backend isn't running, or it crashed. Check terminal 1 — is
  python app.py still running? If you see an error message, Google
  it or ask Vanta. If the terminal exited, restart it.

PROBLEM: AI features fail with "API key missing" or similar
  Your .env file either doesn't exist, doesn't have ANTHROPIC_API_KEY
  set, or the key is invalid. See section 3c.

PROBLEM: pip install fails with long errors about compiling C code
  Some packages need a C compiler on Windows. Install
  "Microsoft C++ Build Tools" from Microsoft's website, then retry.
  Alternatively, try a different Python version (3.11 is a safer
  bet than 3.13 for compatibility with older packages).

PROBLEM: "ModuleNotFoundError: No module named 'X'" when starting
backend
  Your venv is probably not activated, OR pip install didn't finish.
  Make sure your prompt shows "(.venv)". Then run:
      pip install -r requirements.txt

PROBLEM: "Cannot find module" error when starting frontend
  Run `npm install` again in the frontend folder. If that fails,
  delete node_modules entirely and re-run npm install.

PROBLEM: I changed something in backend code and nothing updated
  Stop backend (Ctrl+C in terminal 1) and restart (python app.py).
  Flask in debug mode USUALLY auto-restarts but sometimes misses
  changes.

PROBLEM: I changed something in frontend code and nothing updated
  Frontend should hot-reload automatically. If it doesn't, refresh
  the browser page.

PROBLEM: My database / uploaded files got into a weird state
  You can "reset" by deleting these files in the backend folder:
      simucast.db               (the SQLite database)
      uploads/                  (all uploaded CSVs and trained models)
  Then restart the backend. You'll have to sign up again.

PROBLEM: Report export (PDF/DOCX) fails
  Make sure reportlab and python-docx are installed:
      pip install reportlab python-docx


------------------------------------------------------------------------
  8. WHO TO ASK FOR HELP
------------------------------------------------------------------------

  1. Google the error message. Seriously, most setup problems have
     well-known fixes online.

  2. Ask Vanta in the group chat. Include:
        - What step you were on
        - The full error message (copy-paste, don't retype)
        - A screenshot if the error is visual
        - Which OS you're on (Windows 10, 11, Mac, etc.)

  3. If it's an AI feature issue specifically, double-check your
     .env file and that your API key has credits.


========================================================================
  You're set. Open localhost:5173 in your browser and you're good.
========================================================================
