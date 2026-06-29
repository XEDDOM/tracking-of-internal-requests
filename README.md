# 🚀 Запуск проекта

## Backend

``` bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/MacOS
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Frontend

``` bash
cd frontend
npm install
npm run dev
```