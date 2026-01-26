#### server-base ####
FROM node:23-alpine AS server-base
WORKDIR /usr/local/server

# setup package.json and node_modules
COPY server/package.json server/package-lock.json ./
RUN npm ci

#### server-build ####
FROM server-base AS server-build
WORKDIR /usr/local/server

# copy necessary build files
COPY server/src/ src/
COPY server/tsconfig.json ./

# audit and build
RUN npm audit --production --audit-level=critical
RUN npm run build

# productionise node_modules
RUN npm ci --production

#### final stage ####
FROM node:23-alpine
WORKDIR /opt/server

# copy build artifacts
COPY --from=server-build /usr/local/server/package.json ./
COPY --from=server-build /usr/local/server/node_modules/ node_modules/
COPY --from=server-build /usr/local/server/dist dist/

# copy input file
COPY input.csv /opt/input.csv

ENTRYPOINT ["node", "dist/index.js"]
