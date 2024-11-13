const amqp = require('amqplib/callback_api');

const fs = require('fs');
const PDFDocument = require('pdfkit');
const Handlebars = require('handlebars');
require('dotenv').config();  // Para utilizar variáveis de ambiente

const mysql = require('mysql2');

let connection;

function connectToDatabase() {
  connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  connection.connect((err) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados:', err);
      console.log('Tentando novamente em 5 segundos...');
      setTimeout(connectToDatabase, 5000); // Tenta novamente após 5 segundos
    } else {
      console.log('Conectado ao banco de dados MySQL');
    }
  });
}

connectToDatabase(); // Chama a função de conexão

// Função para consumir mensagens da fila RabbitMQ
function connectRabbitMQ() {
  amqp.connect('amqp://rabbitmq:5672', (err, connection) => {
    if (err) {
      console.error('Erro ao conectar ao RabbitMQ:', err);
      return;
    }

    connection.createChannel((err, channel) => {
      if (err) {
        console.error('Erro ao criar canal RabbitMQ:', err);
        return;
      }

      const queue = 'gerar_certificado';
      channel.assertQueue(queue, { durable: true });
      console.log(`Aguardando mensagens na fila: ${queue}`);

      // Consumindo as mensagens da fila
      channel.consume(queue, (msg) => {
        const diplomaData = JSON.parse(msg.content.toString());
        console.log("Mensagem recebida:", diplomaData);

        // Gerar o certificado em PDF
        gerarCertificado(diplomaData);
      }, { noAck: true });
    });
  });
}

// Função para gerar o PDF do certificado
function gerarCertificado(diploma) {
  // Ler o template HTML
  const templateHTML = fs.readFileSync('template-diploma.html', 'utf8');
  
  // Preparar o template Handlebars
  const template = Handlebars.compile(templateHTML);

  // Substituir os dados no template
  const data = {
    nome: diploma.nome,
    nacionalidade: diploma.nacionalidade,
    estado: diploma.estado,
    data_nascimento: diploma.data_nascimento,
    documento: diploma.documento,
    data_conclusao: diploma.data_conclusao,
    curso: diploma.curso,
    carga_horaria: diploma.carga_horaria,
    data_emissao: new Date().toLocaleDateString('pt-BR'),
    nome_assinatura: diploma.nome_assinatura,
    cargo: diploma.cargo
  };

  const html = template(data);

  // Gerar PDF com o HTML
  const doc = new PDFDocument();
  const filePath = `/certificados/${diploma.nome.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

  // Salvar o PDF no caminho especificado
  doc.pipe(fs.createWriteStream(filePath));
  doc.fontSize(12).text(html);
  doc.end();

  // Após gerar o PDF, atualizar o banco de dados com o caminho do arquivo
  doc.on('finish', () => {
    console.log(`Certificado gerado com sucesso: ${filePath}`);
    
    // Atualizar banco de dados com o caminho do PDF
    const query = `UPDATE diplomas SET certificado_path = ?, nome = ?, nacionalidade = ?, estado = ?, 
                   data_nascimento = ?, documento = ?, data_conclusao = ?, curso = ?, carga_horaria = ?, 
                   data_emissao = ?, nome_assinatura = ?, cargo = ? WHERE id = ?`;

    const values = [
      filePath,
      diploma.nome,
      diploma.nacionalidade,
      diploma.estado,
      diploma.data_nascimento,
      diploma.documento,
      diploma.data_conclusao,
      diploma.curso,
      diploma.carga_horaria,
      new Date(),
      diploma.nome_assinatura,
      diploma.cargo,
      diploma.id
    ];

    connection.query(query, values, (err, result) => {
      if (err) {
        console.error('Erro ao atualizar banco de dados:', err);
      } else {
        console.log(`Certificado atualizado no banco de dados para ${diploma.nome}`);
      }
    });
  });
}

// Iniciar o consumo das mensagens do RabbitMQ
connectRabbitMQ();
