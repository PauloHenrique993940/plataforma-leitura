const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.db');
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do Frontend (após o build)
const frontendPath = path.resolve(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

let db;

// Inicialização do Banco de Dados
(async () => {
    db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    // Criar Tabelas
    await db.exec(`
        CREATE TABLE IF NOT EXISTS turmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            serie TEXT,
            informacoes TEXT
        );

        CREATE TABLE IF NOT EXISTS alunos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            planoIntervencao TEXT,
            turmaId INTEGER,
            FOREIGN KEY (turmaId) REFERENCES turmas (id)
        );

        CREATE TABLE IF NOT EXISTS avaliacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alunoId INTEGER,
            mes TEXT,
            nivel TEXT,
            FOREIGN KEY (alunoId) REFERENCES alunos (id)
        );

        CREATE TABLE IF NOT EXISTS lembretes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            texto TEXT,
            data TEXT
        );

        CREATE TABLE IF NOT EXISTS desempenho_geral (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            serie TEXT,
            mes TEXT,
            nivel TEXT,
            quantidade INTEGER
        );
    `);

    // Migração inicial (se o banco estiver vazio e o JSON existir)
    const turmasCount = await db.get('SELECT count(*) as count FROM turmas');
    if (turmasCount.count === 0 && fs.existsSync(DATA_FILE)) {
        console.log("Migrando dados do data.json para o SQLite...");
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));
            
            // Migrar Turmas e Alunos
            for (const t of data.turmas) {
                const resTurma = await db.run(
                    'INSERT INTO turmas (nome, serie, informacoes) VALUES (?, ?, ?)',
                    [t.nome, t.serie || "1º Ano", t.informacoes || ""]
                );
                const turmaId = resTurma.lastID;

                if (t.alunos) {
                    for (const a of t.alunos) {
                        const resAluno = await db.run(
                            'INSERT INTO alunos (nome, planoIntervencao, turmaId) VALUES (?, ?, ?)',
                            [a.nome, a.planoIntervencao || a.observacao || "", turmaId]
                        );
                        const alunoId = resAluno.lastID;

                        if (a.avaliacoes) {
                            for (const av of a.avaliacoes) {
                                await db.run(
                                    'INSERT INTO avaliacoes (alunoId, mes, nivel) VALUES (?, ?, ?)',
                                    [alunoId, av.mes, av.nivel]
                                );
                            }
                        }
                    }
                }
            }

            // Migrar Lembretes
            if (data.lembretes) {
                for (const l of data.lembretes) {
                    await db.run('INSERT INTO lembretes (texto, data) VALUES (?, ?)', [l.texto, l.data]);
                }
            }
            console.log("Migração concluída com sucesso!");
        } catch (err) {
            console.error("Erro na migração:", err);
        }
    }
})();

// --- ROTAS DA API ---

// Listar Turmas
app.get('/api/turmas', async (req, res) => {
    const turmas = await db.all('SELECT * FROM turmas');
    // Para cada turma, buscar os alunos
    for (let t of turmas) {
        t.alunos = await db.all('SELECT * FROM alunos WHERE turmaId = ?', [t.id]);
        for (let a of t.alunos) {
            a.avaliacoes = await db.all('SELECT * FROM avaliacoes WHERE alunoId = ?', [a.id]);
        }
    }
    res.json(turmas);
});

// Listar Lembretes
app.get('/api/lembretes', async (req, res) => {
    const lembretes = await db.all('SELECT * FROM lembretes ORDER BY id DESC');
    res.json(lembretes);
});

// Criar Turma
app.post('/api/turmas', async (req, res) => {
    const { nome, serie } = req.body;
    const result = await db.run(
        'INSERT INTO turmas (nome, serie, informacoes) VALUES (?, ?, ?)',
        [nome, serie || "1º Ano", ""]
    );
    res.json({ id: result.lastID, nome, serie, alunos: [] });
});

// Editar Turma
app.put('/api/turmas/:id', async (req, res) => {
    const { nome, serie, informacoes } = req.body;
    await db.run(
        'UPDATE turmas SET nome = ?, serie = ?, informacoes = ? WHERE id = ?',
        [nome, serie, informacoes, req.params.id]
    );
    res.json({ id: req.params.id, nome, serie, informacoes });
});

// Excluir Turma
app.delete('/api/turmas/:id', async (req, res) => {
    const { id } = req.params;
    // Buscar alunos da turma para apagar avaliações
    const alunos = await db.all('SELECT id FROM alunos WHERE turmaId = ?', [id]);
    for (const aluno of alunos) {
        await db.run('DELETE FROM avaliacoes WHERE alunoId = ?', [aluno.id]);
    }
    await db.run('DELETE FROM alunos WHERE turmaId = ?', [id]);
    await db.run('DELETE FROM turmas WHERE id = ?', [id]);
    res.status(204).send();
});

// Adicionar Aluno
app.post('/api/turmas/:id/alunos', async (req, res) => {
    const { nome } = req.body;
    const result = await db.run(
        'INSERT INTO alunos (nome, planoIntervencao, turmaId) VALUES (?, ?, ?)',
        [nome, "", req.params.id]
    );
    res.json({ id: result.lastID, nome, planoIntervencao: "", avaliacoes: [] });
});

// Atualizar Plano de Intervenção
app.put('/api/alunos/:id/intervencao', async (req, res) => {
    const { texto } = req.body;
    await db.run('UPDATE alunos SET planoIntervencao = ? WHERE id = ?', [texto, req.params.id]);
    res.json({ success: true });
});

// Registrar Avaliação
app.post('/api/avaliacoes', async (req, res) => {
    const { alunoId, mes, nivel } = req.body;
    
    // Verificar se já existe avaliação para esse mês
    const existing = await db.get('SELECT id FROM avaliacoes WHERE alunoId = ? AND mes = ?', [alunoId, mes]);
    
    if (existing) {
        await db.run('UPDATE avaliacoes SET nivel = ? WHERE id = ?', [nivel, existing.id]);
    } else {
        await db.run('INSERT INTO avaliacoes (alunoId, mes, nivel) VALUES (?, ?, ?)', [alunoId, mes, nivel]);
    }
    
    const aluno = await db.get('SELECT * FROM alunos WHERE id = ?', [alunoId]);
    aluno.avaliacoes = await db.all('SELECT * FROM avaliacoes WHERE alunoId = ?', [alunoId]);
    res.json(aluno);
});

// Lembretes
app.post('/api/lembretes', async (req, res) => {
    const { texto } = req.body;
    const data = new Date().toLocaleDateString();
    const result = await db.run('INSERT INTO lembretes (texto, data) VALUES (?, ?)', [texto, data]);
    res.json({ id: result.lastID, texto, data });
});

app.delete('/api/lembretes/:id', async (req, res) => {
    await db.run('DELETE FROM lembretes WHERE id = ?', [req.params.id]);
    res.status(204).send();
});

// --- NOVAS ROTAS PARA DESEMPENHO GERAL (QUANTIDADES) ---

// Listar todas as quantidades inseridas
app.get('/api/desempenho-geral', async (req, res) => {
    const dados = await db.all('SELECT * FROM desempenho_geral ORDER BY id DESC');
    res.json(dados);
});

// Inserir ou atualizar uma quantidade
app.post('/api/desempenho-geral', async (req, res) => {
    const { serie, mes, nivel, quantidade } = req.body;
    
    // Tenta encontrar se já existe para a mesma série, mês e nível
    const existing = await db.get(
        'SELECT id FROM desempenho_geral WHERE serie = ? AND mes = ? AND nivel = ?',
        [serie, mes, nivel]
    );

    if (existing) {
        await db.run(
            'UPDATE desempenho_geral SET quantidade = ? WHERE id = ?',
            [quantidade, existing.id]
        );
        res.json({ id: existing.id, serie, mes, nivel, quantidade });
    } else {
        const result = await db.run(
            'INSERT INTO desempenho_geral (serie, mes, nivel, quantidade) VALUES (?, ?, ?, ?)',
            [serie, mes, nivel, quantidade]
        );
        res.json({ id: result.lastID, serie, mes, nivel, quantidade });
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// Rota para qualquer outra requisição (deve ser a última)
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});
