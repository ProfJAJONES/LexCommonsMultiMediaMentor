# LexCommons — Faculty App

## Project
React/Vite faculty LMS at teaching.lexcommons.org and faculty.lexcommons.org.
Part of the LexCommons multi-site legal education platform.

## Deploy Command
```bash
npm run build && rsync -avz --delete dist/ root@45.82.72.210:/var/www/teaching/ && rsync -avz --delete dist/ root@45.82.72.210:/var/www/faculty/
```

## Architecture
- **Frontend:** React (Vite), single App.jsx + components/
- **API:** https://api.lexcommons.org (Node.js on EC2 54.214.130.86)
- **VPS:** root@45.82.72.210 (nginx, serves static dist/)
- **DB:** PostgreSQL on RDS — lexcommons-db.cl0o6ia04wsw.us-west-2.rds.amazonaws.com
- **EC2 access:** AWS Console → EC2 → Instance Connect (SSH key not working locally)
- **VPS access:** ssh root@45.82.72.210 (password auth)

## Brand
Navy #0B1D3A, Gold #C9A84C, Claret #8B4558, Linen #F4F6F9

## Key Patterns
- Auth token stored in localStorage as `lc_user` (JSON with `.token`)
- All API calls use `api()` helper with Bearer token
- React hooks destructured (useState not React.useState)
- VPS file writes: always Python scripts, never bash heredocs
- module.exports must be last line in route files

## Other Sites
- lexcommons.org — marketing/umbrella
- ops.lexcommons.org — admin dashboard
- classroom.lexcommons.org — student LMS
- lawschoolcommons.com — student portal
- cite.lexcommons.org — citation checker
