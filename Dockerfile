FROM node:lts-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --mode development
EXPOSE 8080
CMD ["npm", "run", "serve"]
