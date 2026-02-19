const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/plataforma_leitura';

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do Frontend
const frontendPath = path.resolve(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

// Conexão com MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// --- SCHEMAS (ESTRUTURA DOS DADOS) ---

const AvaliacaoSchema = new mongoose.Schema({
  mes: String,
  nivel: String
});

const AlunoSchema = new mongoose.Schema({
  nome: String,
  planoIntervencao: { type: String, default: "" },
  avaliacoes: [AvaliacaoSchema]
});

const TurmaSchema = new mongoose.Schema({
  nome: String,
  serie: { type: String, default: "1º Ano" },
  informacoes: { type: String, default: "" },
  alunos: [AlunoSchema]
});

const LembreteSchema = new mongoose.Schema({
  texto: String,
  data: String
});

const DesempenhoGeralSchema = new mongoose.Schema({
  serie: String,
  mes: String,
  nivel: String,
  quantidade: Number
});

const Turma = mongoose.model('Turma', TurmaSchema);
const Lembrete = mongoose.model('Lembrete', LembreteSchema);
const DesempenhoGeral = mongoose.model('DesempenhoGeral', DesempenhoGeralSchema);

// --- ROTAS DA API ---

// Listar Turmas
app.get('/api/turmas', async (req, res) => {
  const turmas = await Turma.find();
  res.json(turmas);
});

// Criar Turma
app.post('/api/turmas', async (req, res) => {
  const { nome, serie } = req.body;
  const novaTurma = new Turma({ nome, serie });
  await novaTurma.save();
  res.json(novaTurma);
});

// Excluir Turma
app.delete('/api/turmas/:id', async (req, res) => {
  await Turma.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

// Adicionar Aluno
app.post('/api/turmas/:id/alunos', async (req, res) => {
  const { nome } = req.body;
  const turma = await Turma.findById(req.params.id);
  turma.alunos.push({ nome });
  await turma.save();
  res.json(turma.alunos[turma.alunos.length - 1]);
});

// Atualizar Plano de Intervenção
app.put('/api/alunos/:id/intervencao', async (req, res) => {
  const { texto } = req.body;
  const turma = await Turma.findOne({ "alunos._id": req.params.id });
  const aluno = turma.alunos.id(req.params.id);
  aluno.planoIntervencao = texto;
  await turma.save();
  res.json({ success: true });
});

// Registrar Avaliação
app.post('/api/avaliacoes', async (req, res) => {
  const { alunoId, mes, nivel } = req.body;
  const turma = await Turma.findOne({ "alunos._id": alunoId });
  const aluno = turma.alunos.id(alunoId);
  
  const existingIdx = aluno.avaliacoes.findIndex(av => av.mes === mes);
  if (existingIdx !== -1) {
    aluno.avaliacoes[existingIdx].nivel = nivel;
  } else {
    aluno.avaliacoes.push({ mes, nivel });
  }
  
  await turma.save();
  res.json(aluno);
});

// Lembretes
app.get('/api/lembretes', async (req, res) => {
  const lembretes = await Lembrete.find().sort({ _id: -1 });
  res.json(lembretes);
});

app.post('/api/lembretes', async (req, res) => {
  const { texto } = req.body;
  const novo = new Lembrete({ texto, data: new Date().toLocaleDateString() });
  await novo.save();
  res.json(novo);
});

app.delete('/api/lembretes/:id', async (req, res) => {
  await Lembrete.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

// Desempenho Geral
app.get('/api/desempenho-geral', async (req, res) => {
  const dados = await DesempenhoGeral.find().sort({ _id: -1 });
  res.json(dados);
});

app.post('/api/desempenho-geral', async (req, res) => {
  const { serie, mes, nivel, quantidade } = req.body;
  await DesempenhoGeral.findOneAndUpdate(
    { serie, mes, nivel },
    { quantidade },
    { upsert: true, new: true }
  );
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// Rota SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
