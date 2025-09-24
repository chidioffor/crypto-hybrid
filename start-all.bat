@echo off
setlocal EnableDelayedExpansion

if exist .env (
  for /f "usebackq tokens=1* delims==" %%A in (`findstr /r /v "^#" ".env"`) do (
    if not "%%A"=="" (
      set "name=%%A"
      set "value=%%B"
      for /f "tokens=* delims= " %%C in ("!value!") do set "value=%%C"
      set "!name!=!value!"
    )
  )
)

set "missing="
for %%V in (JWT_SECRET WALLET_ENCRYPTION_KEY CARD_DATA_ENCRYPTION_KEY) do (
  if "!%%V!"=="" (
    if defined missing (
      set "missing=!missing!, %%V"
    ) else (
      set "missing=%%V"
    )
  )
)

if defined missing (
  echo [ERROR] Missing required secrets: !missing!
  echo Please populate the values in your .env file before running this script.
  exit /b 1
)

echo Starting CryptoHybrid Bank Services...

echo Starting User Service...
start "User Service" cmd /k "cd services\user-service && set USER_SERVICE_URL=http://localhost:3001 && set WALLET_SERVICE_URL=http://localhost:3002 && set PAYMENT_SERVICE_URL=http://localhost:3003 && set CARD_SERVICE_URL=http://localhost:3004 && node src/index.js"

timeout /t 3 /nobreak

echo Starting Wallet Service...
start "Wallet Service" cmd /k "cd services\wallet-service && set USER_SERVICE_URL=http://localhost:3001 && set WALLET_SERVICE_URL=http://localhost:3002 && set PAYMENT_SERVICE_URL=http://localhost:3003 && set CARD_SERVICE_URL=http://localhost:3004 && node src/index.js"

timeout /t 3 /nobreak

echo Starting Payment Service...
start "Payment Service" cmd /k "cd services\payment-service && set USER_SERVICE_URL=http://localhost:3001 && set WALLET_SERVICE_URL=http://localhost:3002 && set PAYMENT_SERVICE_URL=http://localhost:3003 && set CARD_SERVICE_URL=http://localhost:3004 && node src/index.js"

timeout /t 3 /nobreak

echo Starting Card Service...
start "Card Service" cmd /k "cd services\card-service && set USER_SERVICE_URL=http://localhost:3001 && set WALLET_SERVICE_URL=http://localhost:3002 && set PAYMENT_SERVICE_URL=http://localhost:3003 && set CARD_SERVICE_URL=http://localhost:3004 && node src/index.js"

timeout /t 3 /nobreak

echo Starting API Gateway...
start "API Gateway" cmd /k "cd services\api-gateway && set USER_SERVICE_URL=http://localhost:3001 && set WALLET_SERVICE_URL=http://localhost:3002 && set PAYMENT_SERVICE_URL=http://localhost:3003 && set CARD_SERVICE_URL=http://localhost:3004 && node src/index.js"

timeout /t 5 /nobreak

echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && set REACT_APP_API_URL=http://localhost:3000 && npm start"

echo.
echo All services are starting up!
echo.
echo Access points:
echo - Frontend: http://localhost:3005
echo - API Gateway: http://localhost:3000
echo - API Documentation: http://localhost:3000/api/docs
echo.
echo Wait for all services to fully start before testing.
echo.
pause
endlocal
