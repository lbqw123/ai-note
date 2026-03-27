@echo off
cd /d "%~dp0"
echo Starting backend server...
python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0
pause
