# Usado só pelo Railway: sobe a ponte do WhatsApp do AION (pasta whatsapp/). A Vercel ignora este arquivo.
FROM node:22-slim
WORKDIR /app
COPY whatsapp/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY whatsapp/index.js ./
CMD ["node", "index.js"]
