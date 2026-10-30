# Local Development

You need Node.js, npm, Git and a working PostgreSQL installation.

From the repository root:

```bash
npm --prefix backend ci
npm --prefix frontend ci
cp backend/.env.example backend/.env
```

On Windows PowerShell use `Copy-Item backend/.env.example backend/.env`.

Configure PostgreSQL and environment variables, then run in separate terminals:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

The Vite frontend normally serves at `http://localhost:5173` and proxies `/api` to the backend on port `3000`.

## Quality checks

```bash
npm --prefix backend run test
npm --prefix backend run build
npm --prefix frontend run build
```

Consult [CONTRIBUTING.md](https://github.com/Sysadminfromhell/LP-Tracker/blob/main/CONTRIBUTING.md) for branch policy, testing and project standards.

## Wiki preview on Windows

With a Python 3.13 virtual environment containing `zensical==0.0.72`, you can run:

```powershell
.\.venv\Scripts\python.exe -m zensical.main serve
```

This avoids invoking the separately generated `zensical.exe` launcher if Microsoft Defender ASR blocks it.
