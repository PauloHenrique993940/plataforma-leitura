import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart3, Users, BookOpen, Plus, Trash2, Edit3, 
  Download, Bell, TrendingUp, TrendingDown, Info, 
  Settings2, Search, LayoutDashboard, AlertCircle, ListChecks, CheckCircle, Save, X
} from 'lucide-react';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, 
  ArcElement, PointElement, LineElement, RadialLinearScale 
} from 'chart.js';
import { Bar, Pie, Line, Doughnut, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, 
  ArcElement, PointElement, LineElement, RadialLinearScale
);

const API_URL = import.meta.env.MODE === 'development' 
  ? 'http://localhost:3001/api' 
  : '/api';
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SERIES = ["1º Ano", "2º Ano", "3º Ano", "4º Ano", "5º Ano"];

function App() {
  const [tab, setTab] = useState('dashboard');
  const [turmas, setTurmas] = useState([]);
  const [selectedTurma, setSelectedTurma] = useState(null);
  const [lembretes, setLembretes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSerie, setSelectedSerie] = useState('Todas');
  
  // Customização de Gráficos
  const [chartType, setChartType] = useState('bar'); 
  const [chartColors, setChartColors] = useState(['#01B8AA', '#F2C80F', '#FD625E']);

  // Gestão
  const [newTurma, setNewTurma] = useState({ nome: '', serie: '1º Ano' });
  const [newAlunoName, setNewAlunoName] = useState('');
  const [intervencaoModal, setIntervencaoModal] = useState(null);
  const [newReminder, setNewReminder] = useState('');

  // Estado para Cadastro de Quantidades (Desempenho Geral)
  const [desempenhoForm, setDesempenhoForm] = useState({
    serie: '1º Ano',
    mes: MESES[new Date().getMonth()],
    Fluente: 0,
    Mediano: 0,
    Soletra: 0
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [resT, resL] = await Promise.all([
        axios.get(`${API_URL}/turmas`),
        axios.get(`${API_URL}/lembretes`)
      ]);
      setTurmas(resT.data);
      setLembretes(resL.data);
      if (resT.data.length > 0 && !selectedTurma) setSelectedTurma(resT.data[0]);
    } catch (err) { console.error(err); }
  };

  const deleteTurma = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta turma e todos os seus alunos?')) {
      await axios.delete(`${API_URL}/turmas/${id}`);
      fetchAll();
    }
  };

  const saveDesempenhoGeral = async () => {
    const niveis = ['Fluente', 'Mediano', 'Soletra'];
    try {
      for (const nivel of niveis) {
        await axios.post(`${API_URL}/desempenho-geral`, {
          serie: desempenhoForm.serie,
          mes: desempenhoForm.mes,
          nivel: nivel,
          quantidade: parseInt(desempenhoForm[nivel] || 0)
        });
      }
      alert('Dados de desempenho salvos com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar dados.');
    }
  };

  const registerAvaliacao = async (alunoId, nivel) => {
    const mes = MESES[new Date().getMonth()];
    await axios.post(`${API_URL}/avaliacoes`, { alunoId, turmaId: selectedTurma.id, mes, nivel });
    fetchAll();
  };

  const saveIntervencao = async () => {
    if (!intervencaoModal) return;
    await axios.put(`${API_URL}/alunos/${intervencaoModal.id}/intervencao`, { texto: intervencaoModal.plano });
    setIntervencaoModal(null);
    fetchAll();
  };

  // Lógica de Alertas
  const getAlerts = () => {
    let alerts = [];
    const nivelValor = { 'Fluente': 2, 'Mediano': 1, 'Soletra': 0 };

    turmas.forEach(t => {
      t.alunos.forEach(a => {
        const history = a.avaliacoes;
        if (history.length >= 1) {
          const lastAv = history[history.length - 1];
          const last = lastAv.nivel;
          
          if (history.length >= 2) {
            const prev = history[history.length - 2].nivel;
            
            if (nivelValor[last] < nivelValor[prev]) {
              alerts.push({ 
                id: a.id, 
                aluno: a.nome, 
                turma: t.nome, 
                motivo: `Regrediu (${prev} → ${last})`,
                plano: a.planoIntervencao 
              });
            } else if (last === 'Soletra' && prev === 'Soletra') {
              alerts.push({ 
                id: a.id, 
                aluno: a.nome, 
                turma: t.nome, 
                motivo: 'Estagnado no Soletra',
                plano: a.planoIntervencao 
              });
            }
          } else if (last === 'Soletra') {
            alerts.push({ 
              id: a.id, 
              aluno: a.nome, 
              turma: t.nome, 
              motivo: 'Nível Crítico (Soletra)',
              plano: a.planoIntervencao 
            });
          }
        }
      });
    });
    return alerts;
  };

  // DADOS PARA OS GRÁFICOS
  const getChartData = () => {
    const stats = { Fluente: 0, Mediano: 0, Soletra: 0 };
    const targetTurmas = selectedSerie === 'Todas' ? turmas : turmas.filter(t => t.serie === selectedSerie);
    
    targetTurmas.forEach(t => {
      t.alunos.forEach(a => {
        const last = a.avaliacoes[a.avaliacoes.length - 1]?.nivel;
        if (last) stats[last]++;
      });
    });

    return {
      labels: ['Fluente', 'Mediano', 'Soletra'],
      datasets: [{
        label: 'Quantidade de Alunos',
        data: [stats.Fluente, stats.Mediano, stats.Soletra],
        backgroundColor: chartColors,
        borderColor: chartColors,
        borderWidth: 1,
        borderRadius: 8
      }]
    };
  };

  const getLineData = () => {
    const dataFluente = MESES.map(m => {
      let count = 0;
      const targetTurmas = selectedSerie === 'Todas' ? turmas : turmas.filter(t => t.serie === selectedSerie);
      targetTurmas.forEach(t => {
        t.alunos.forEach(a => {
          if (a.avaliacoes.find(av => av.mes === m && av.nivel === 'Fluente')) count++;
        });
      });
      return count;
    });

    return {
      labels: MESES,
      datasets: [{
        label: 'Evolução Fluentes',
        data: dataFluente,
        borderColor: chartColors[0],
        backgroundColor: chartColors[0] + '33',
        fill: true,
        tension: 0.4
      }]
    };
  };

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="logo-area">📖 EduBI <strong>Master</strong></div>
        
        <div className="nav-links">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}><LayoutDashboard size={18}/> Dashboard</button>
          <button className={tab === 'avaliacao' ? 'active' : ''} onClick={() => setTab('avaliacao')}><ListChecks size={18}/> Avaliação</button>
          <button className={tab === 'gestao' ? 'active' : ''} onClick={() => setTab('gestao')}><Users size={18}/> Gestão Escolar</button>
        </div>

        <div className="serie-filter">
          <h4>Filtrar por Série</h4>
          <select value={selectedSerie} onChange={e => setSelectedSerie(e.target.value)}>
            <option value="Todas">Todas</option>
            {SERIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="config-panel">
          <h4><Settings2 size={14}/> Tipo de Gráfico</h4>
          <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
            <option value="bar">📊 Barras</option>
            <option value="pie">🍕 Pizza</option>
            <option value="doughnut">🍩 Rosca</option>
            <option value="line">📈 Linha (Evolução)</option>
            <option value="radar">🕸️ Radar</option>
          </select>
          <label>Cores Personalizadas:</label>
          <div className="color-pickers">
             <input type="color" value={chartColors[0]} onChange={(e) => setChartColors([e.target.value, chartColors[1], chartColors[2]])} />
             <input type="color" value={chartColors[1]} onChange={(e) => setChartColors([chartColors[0], e.target.value, chartColors[2]])} />
             <input type="color" value={chartColors[2]} onChange={(e) => setChartColors([chartColors[0], chartColors[1], e.target.value])} />
          </div>
        </div>
      </nav>

      <main className="content">
        <header>
          <h2>{selectedSerie === 'Todas' ? 'Visão Geral' : selectedSerie}</h2>
          <div className="search-box">
            <Search size={16}/>
            <input type="text" placeholder="Buscar aluno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </header>

        {tab === 'dashboard' && (
          <div className="dashboard-view">
            <div className="kpi-row">
              <div className="kpi-card danger"><span>Alertas</span><h2>{getAlerts().length}</h2></div>
              <div className="kpi-card success"><span>Fluência</span><h2>{((getChartData().datasets[0].data[0] / (getChartData().datasets[0].data.reduce((a,b)=>a+b,0) || 1)) * 100).toFixed(0)}%</h2></div>
              <button className="btn-export" onClick={() => window.print()}><Download size={16}/> Exportar PDF</button>
            </div>

            <div className="charts-grid">
              <div className="main-chart-container">
                <h3>Análise Gráfica: {chartType.toUpperCase()}</h3>
                <div className="chart-render">
                   {chartType === 'bar' && <Bar data={getChartData()} options={{maintainAspectRatio: false}} />}
                   {chartType === 'pie' && <Pie data={getChartData()} options={{maintainAspectRatio: false}} />}
                   {chartType === 'doughnut' && <Doughnut data={getChartData()} options={{maintainAspectRatio: false}} />}
                   {chartType === 'line' && <Line data={getLineData()} options={{maintainAspectRatio: false}} />}
                   {chartType === 'radar' && <Radar data={getChartData()} options={{maintainAspectRatio: false}} />}
                </div>
              </div>
              <div className="alerts-box">
                <h3>🚨 Ações Necessárias</h3>
                <div className="alerts-list">
                  {getAlerts().map((alert, i) => (
                    <div key={i} className="alert-item">
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                        <div>
                          <strong>{alert.aluno}</strong>
                          <span>{alert.turma} • {alert.motivo}</span>
                        </div>
                        <button className="btn-interv" onClick={() => setIntervencaoModal(alert)}>
                          {alert.plano ? 'Editar' : 'Criar'}
                        </button>
                      </div>
                      
                      {alert.plano ? (
                        <div className="plano-preview">
                          <strong>Plano de Ação:</strong>
                          <p style={{margin: 0}}>{alert.plano}</p>
                        </div>
                      ) : (
                        <div className="plano-preview" style={{fontStyle: 'italic', color: '#999'}}>
                          Nenhum plano de ação definido.
                        </div>
                      )}
                    </div>
                  ))}
                  {getAlerts().length === 0 && <p style={{fontSize:'0.8rem', color:'#7f8c8d'}}>Nenhum alerta crítico no momento.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'avaliacao' && (
          <div className="evaluation-area">
             <div className="turma-selector-bar">
               {turmas.filter(t => selectedSerie === 'Todas' || t.serie === selectedSerie).map(t => (
                 <button key={t.id} className={selectedTurma?.id === t.id ? 'active' : ''} onClick={() => setSelectedTurma(t)}>{t.nome}</button>
               ))}
            </div>
            <table className="eval-table">
              <thead><tr><th>Aluno</th><th>Nível</th><th>Plano</th><th>Ações</th></tr></thead>
              <tbody>
                {selectedTurma?.alunos.filter(a => a.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(a => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                    <td><span className={`badge ${a.avaliacoes[a.avaliacoes.length-1]?.nivel}`}>{a.avaliacoes[a.avaliacoes.length-1]?.nivel || 'Pendente'}</span></td>
                    <td>
                       <button className="btn-interv" onClick={() => setIntervencaoModal({id: a.id, aluno: a.nome, plano: a.planoIntervencao})}>
                         {a.planoIntervencao ? 'Ver Plano' : '+ Criar'}
                       </button>
                    </td>
                    <td className="actions">
                      <button className="btn-s" style={{background: chartColors[2]}} onClick={() => registerAvaliacao(a.id, 'Soletra')}>S</button>
                      <button className="btn-m" style={{background: chartColors[1]}} onClick={() => registerAvaliacao(a.id, 'Mediano')}>M</button>
                      <button className="btn-f" style={{background: chartColors[0]}} onClick={() => registerAvaliacao(a.id, 'Fluente')}>F</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'gestao' && (
          <div className="gestao-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: '20px'}}>
             <div className="card" style={{background:'white', padding:'20px', borderRadius:'12px'}}>
               <h3>Nova Turma</h3>
               <div className="input-row">
                 <input type="text" placeholder="Ex: 2º Ano C" value={newTurma.nome} onChange={e => setNewTurma({...newTurma, nome: e.target.value})} />
                 <select value={newTurma.serie} onChange={e => setNewTurma({...newTurma, serie: e.target.value})}>
                   {SERIES.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
                 <button onClick={async () => { await axios.post(`${API_URL}/turmas`, newTurma); setNewTurma({nome:'', serie:'1º Ano'}); fetchAll(); }}>Criar</button>
               </div>

               <h3 style={{marginTop: '30px'}}>Turmas Existentes</h3>
               <div className="turmas-list" style={{marginTop: '15px'}}>
                  {turmas.map(t => (
                    <div key={t.id} style={{display:'flex', justifyContent:'space-between', padding: '10px', borderBottom: '1px solid #eee'}}>
                      <span><strong>{t.nome}</strong> ({t.serie})</span>
                      <button onClick={() => deleteTurma(t.id)} style={{background: '#ff4d4d', padding: '5px 10px'}}><Trash2 size={14}/></button>
                    </div>
                  ))}
               </div>
             </div>

             <div className="card" style={{background:'white', padding:'20px', borderRadius:'12px'}}>
               <h3>Cadastrar Quantitativos por Nível</h3>
               <p style={{fontSize: '0.8rem', color: '#666', marginBottom: '15px'}}>Use esta opção para inserir dados consolidados de uma série inteira.</p>
               
               <div className="form-group" style={{marginBottom: '15px'}}>
                 <label>Série e Mês:</label>
                 <div className="input-row">
                    <select value={desempenhoForm.serie} onChange={e => setDesempenhoForm({...desempenhoForm, serie: e.target.value})}>
                      {SERIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={desempenhoForm.mes} onChange={e => setDesempenhoForm({...desempenhoForm, mes: e.target.value})}>
                      {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                 </div>
               </div>

               <div className="form-group" style={{marginBottom: '10px'}}>
                 <label>Quantidade Fluentes:</label>
                 <input type="number" style={{width:'100%', padding:'8px', marginTop:'5px'}} value={desempenhoForm.Fluente} onChange={e => setDesempenhoForm({...desempenhoForm, Fluente: e.target.value})} />
               </div>
               <div className="form-group" style={{marginBottom: '10px'}}>
                 <label>Quantidade Mediano:</label>
                 <input type="number" style={{width:'100%', padding:'8px', marginTop:'5px'}} value={desempenhoForm.Mediano} onChange={e => setDesempenhoForm({...desempenhoForm, Mediano: e.target.value})} />
               </div>
               <div className="form-group" style={{marginBottom: '15px'}}>
                 <label>Quantidade Soletra:</label>
                 <input type="number" style={{width:'100%', padding:'8px', marginTop:'5px'}} value={desempenhoForm.Soletra} onChange={e => setDesempenhoForm({...desempenhoForm, Soletra: e.target.value})} />
               </div>

               <button onClick={saveDesempenhoGeral} style={{width: '100%'}}><Save size={16}/> Salvar Desempenho Geral</button>
             </div>
          </div>
        )}

        {intervencaoModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Plano de Intervenção: {intervencaoModal.aluno}</h3>
              <p style={{fontSize: '0.8rem', color: '#666'}}>Defina as ações para melhorar o desempenho do aluno.</p>
              <textarea 
                placeholder="Ex: Reforço em fonética, leitura guiada 2x por semana..."
                value={intervencaoModal.plano || ''} 
                onChange={e => setIntervencaoModal({...intervencaoModal, plano: e.target.value})}
              />
              <div className="modal-actions">
                <button className="btn-cancel" style={{background:'#eee', color:'#333'}} onClick={() => setIntervencaoModal(null)}>Cancelar</button>
                <button onClick={saveIntervencao}><Save size={16}/> Salvar Plano</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
