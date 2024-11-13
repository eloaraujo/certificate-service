CREATE DATABASE certificados;

USE certificados;

CREATE TABLE diplomas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    nacionalidade VARCHAR(100),
    estado VARCHAR(100),
    data_nascimento DATE,
    documento VARCHAR(20),
    data_conclusao DATE,
    curso VARCHAR(255),
    carga_horaria INT,
    data_emissao DATE,
    nome_assinatura VARCHAR(255),
    cargo VARCHAR(255),
    certificado_path VARCHAR(255)
);
