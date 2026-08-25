# -----------------------------
# STAGE 1: BUILD
# -----------------------------
# CORREÇÃO: Adicionado "AS build" aqui para o Docker saber quem referenciar depois
FROM node:20-bullseye AS build

WORKDIR /app

COPY package*.json ./

# Dica: use --omit=dev no lugar de --production (o npm moderno prefere assim)
RUN npm install --omit=dev

COPY . .

# -----------------------------
# STAGE 2: RUN (PROD)
# -----------------------------
FROM node:20-bullseye

WORKDIR /app

# Agora o Docker vai achar o "build" com sucesso!
COPY --from=build /app /app

EXPOSE 5001

CMD ["node", "index.js"]