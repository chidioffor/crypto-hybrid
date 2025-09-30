Required per-service .env files. MAke sure to Create these if you want to use .env when starting up services.
######################################################
Edit these files first and add the actual SECRET Keys.
#####################################################

services/api-gateway/.env
JWT_SECRET=dev_jwt_secret_please_change
PORT=3000
CORS_ORIGIN=http://localhost:3005


services/user-service/.env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cryptohybrid
JWT_SECRET=dev_jwt_secret_please_change
PORT=3001


services/wallet-service/.env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cryptohybrid
JWT_SECRET=dev_jwt_secret_please_change
PORT=3002


services/payment-service/.env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cryptohybrid
JWT_SECRET=dev_jwt_secret_please_change
STRIPE_SECRET_KEY=sk_test_1234567890
PORT=3003


services/card-service/.env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cryptohybrid
JWT_SECRET=dev_jwt_secret_please_change
PORT=3004

################################
If you’re using Docker for databases

Bring infra up first (so DATABASE_URL works):

npm run docker:up
# or: docker-compose up -d

Then start all services
./scripts/dev-all.sh
###################################


