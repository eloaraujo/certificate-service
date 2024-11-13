// Importando dependências
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const amqp = require('amqplib/callback_api');
const redis = require('redis');
require('dotenv').config();

// Inicializando o servidor Express
const app = express();
const port = process.env.PORT || 3000;

// Configuração do banco de dados MySQL usando as variáveis de ambiente
const db = mysql.createConnection({
  host: certificate-service-db,
  user: certificados,
  password: certificado123,
  database: certificados,
});

// Conectando ao banco de dados
db.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conectado ao banco de dados MySQL');
  }
});

// Configuração do cliente Redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

redisClient.connect()
  .then(() => {
    console.log('Conectado ao Redis');
  })
  .catch(err => {
    console.error('Erro ao conectar ao Redis:', err);
  });

// Configuração do RabbitMQ
function connectRabbitMQ() {
  amqp.connect(process.env.RABBITMQ_URL, (err, connection) => {
    if (err) {
      console.error('Erro ao conectar ao RabbitMQ:', err);
      return;
    }

    connection.createChannel((err, channel) => {
      if (err) {
        console.error('Erro ao criar canal no RabbitMQ:', err);
        return;
      }

      const queue = 'gerar_certificado';
      channel.assertQueue(queue, { durable: true });
      console.log(`Aguardando mensagens na fila: ${queue}`);
      
      channel.consume(queue, (msg) => {
        const diplomaData = JSON.parse(msg.content.toString());
        console.log("Mensagem recebida:", diplomaData);
      
        gerarCertificado(diplomaData);
      }, { noAck: true });      
    });
  });
}

connectRabbitMQ();

// Middleware para tratar JSON no corpo das requisições
app.use(bodyParser.json());

// Endpoint para criar um certificado
app.post('/gerar_certificado', async (req, res) => {
  const { nome, curso, data_conclusao, nome_assinatura, cargo, carga_horaria } = req.body;

  // Inserir os dados no banco de dados
  const query = `INSERT INTO diplomas (nome, curso, data_conclusao, nome_assinatura, cargo, carga_horaria)
                 VALUES (?, ?, ?, ?, ?, ?)`;

  const values = [nome, curso, data_conclusao, nome_assinatura, cargo, carga_horaria];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Erro ao inserir no banco de dados:', err);
      return res.status(500).json({ message: 'Erro ao salvar certificado' });
    }

    const diplomaId = result.insertId;
    console.log('Certificado registrado no banco, ID:', diplomaId);

    // Enviar uma mensagem para a fila RabbitMQ para gerar o certificado
    amqp.connect('amqp://rabbitmq:5672', (err, connection) => {
      if (err) {
        console.error('Erro ao conectar ao RabbitMQ:', err);
        return res.status(500).json({ message: 'Erro ao conectar ao RabbitMQ' });
      }

      connection.createChannel((err, channel) => {
        if (err) {
          console.error('Erro ao criar canal RabbitMQ:', err);
          return res.status(500).json({ message: 'Erro ao criar canal RabbitMQ' });
        }

        const queue = 'gerar_certificado';
        channel.assertQueue(queue, { durable: true });

        const message = JSON.stringify({ id: diplomaId, nome, curso, data_conclusao, nome_assinatura, cargo });
        channel.sendToQueue(queue, Buffer.from(message));
        console.log('Mensagem enviada para a fila RabbitMQ:', message);
      });
    });

    res.status(200).json({ message: 'Certificado solicitado com sucesso!' });
  });
});

// Iniciar o servidor Express
app.listen(port, () => {
  console.log(`API rodando na porta ${port}`);
});
