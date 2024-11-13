# Usando a imagem oficial do Node.js
FROM node:16

# Copiando o package.json e o package-lock.json para o container
COPY package*.json ./

# Instalando as dependências
RUN npm install

# Copiando o restante dos arquivos
COPY . .

# Expondo a porta que a API vai rodar
EXPOSE 3000

# Iniciando o servidor da API
CMD ["node", "index.js"]


