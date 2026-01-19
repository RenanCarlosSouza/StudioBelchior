/* ============================================================
   SISTEMA CARLINHOS 2.0 - LÓGICA FINAL (COM BOTÃO WPP)
   ============================================================ */

// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDfFLsCZAq4CA4bOjVKvwZzYsTVVAekl74",
    authDomain: "sistema-carlinhos-1.firebaseapp.com",
    projectId: "sistema-carlinhos-1",
    storageBucket: "sistema-carlinhos-1.firebasestorage.app",
    messagingSenderId: "170878331203",
    appId: "1:170878331203:web:31a3649680f226333927f6"
};

// INICIALIZAÇÃO
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- CONFIGURAÇÃO DE SEGURANÇA E ACESSOS ---
const EMAIL_ADMIN = "edanios@studio.com";        // TEM ACESSO TOTAL
const EMAIL_ESTAGIARIO = "rehsouzaofc17@gmail.com"; // SÓ MARCA PAGAMENTO

// --- CONFIGURAÇÃO DA AGENDA ---
const MAX_ALUNOS_POR_HORARIO = 8;

// --- VARIÁVEIS GLOBAIS ---
let listaClientes = [];
let dbPagamentos = {};
let dbGastos = [];
let dbAgenda = {};
let filtroAtualClientes = 'todos';

// Listeners
let unsubscribeClientes = null;
let unsubscribePagamentos = null;
let unsubscribeGastos = null;
let unsubscribeAgenda = null;

// Configuração de Datas
const inputMes = document.getElementById('mesReferencia');
const hoje = new Date();
const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

if (inputMes) {
    inputMes.value = mesAtual;
    inputMes.addEventListener('change', () => carregarDadosDoMes());
}

const horariosFuncionamento = [
    "07:00 - 08:00", "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00",
    "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00",
    "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00"
];
let diaAtualAgenda = 'segunda';

// ======================================================
// 1. SISTEMA DE LOGIN E SEGURANÇA
// ======================================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário Logado
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('appConteudo').style.display = 'block';

        const isAdmin = user.email === EMAIL_ADMIN;

        // CONTROLE VISUAL: Só ADMIN vê botão financeiro
        const btnFinanceiro = document.querySelector("button[onclick=\"mostrarTela('financeiro')\"]");

        if (isAdmin) {
            btnFinanceiro.style.display = "inline-block";
        } else {
            btnFinanceiro.style.display = "none";
            if (document.getElementById('financeiro').classList.contains('ativa')) {
                window.mostrarTela('agenda');
            }
        }

        iniciarListenersEmTempoReal(user);
    } else {
        // Deslogado
        document.getElementById('telaLogin').style.display = 'flex';
        document.getElementById('appConteudo').style.display = 'none';
    }
});

window.fazerLogin = () => {
    const email = document.getElementById('emailLogin').value;
    const pass = document.getElementById('senhaLogin').value;
    const msgErro = document.getElementById('msgErroLogin');

    msgErro.innerText = "AUTENTICANDO...";

    signInWithEmailAndPassword(auth, email, pass)
        .catch((error) => {
            msgErro.innerText = "ERRO: E-MAIL OU SENHA INCORRETOS.";
            console.error(error);
        });
}

window.fazerLogout = () => {
    signOut(auth);
    location.reload();
}

// ======================================================
// 2. LISTENERS (CARREGAMENTO DE DADOS)
// ======================================================

function iniciarListenersEmTempoReal(user) {
    unsubscribeClientes = onSnapshot(collection(db, "clientes"), (snapshot) => {
        listaClientes = [];
        snapshot.forEach((doc) => listaClientes.push({ id: doc.id, ...doc.data() }));
        renderizarClientes();
    });

    unsubscribeAgenda = onSnapshot(collection(db, "agenda"), (snapshot) => {
        dbAgenda = { segunda: {}, terca: {}, quarta: {}, quinta: {}, sexta: {} };
        snapshot.forEach((doc) => {
            dbAgenda[doc.id] = doc.data();
        });
        renderizarAgenda();
    });

    carregarDadosDoMes(user);
}

function carregarDadosDoMes(user = auth.currentUser) {
    const mes = inputMes.value;
    const inputFin = document.getElementById('mesFinanceiro');
    if (inputFin) inputFin.value = mes;

    if (unsubscribePagamentos) unsubscribePagamentos();
    if (unsubscribeGastos) unsubscribeGastos();

    const temPermissaoPagamentos = (user.email === EMAIL_ADMIN || user.email === EMAIL_ESTAGIARIO);

    if (temPermissaoPagamentos) {
        const qPagamentos = query(collection(db, "pagamentos"), where("mesReferencia", "==", mes));
        unsubscribePagamentos = onSnapshot(qPagamentos, (snapshot) => {
            dbPagamentos = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                dbPagamentos[data.clienteId] = data;
            });
            renderizarClientes();
            if (user.email === EMAIL_ADMIN) renderizarFinanceiro();
        });

        if (user.email === EMAIL_ADMIN) {
            const qGastos = query(collection(db, "gastos"), where("mesReferencia", "==", mes));
            unsubscribeGastos = onSnapshot(qGastos, (snapshot) => {
                dbGastos = [];
                snapshot.forEach((doc) => dbGastos.push({ id: doc.id, ...doc.data() }));
                renderizarFinanceiro();
            });
        }

    } else {
        dbPagamentos = {};
        dbGastos = [];
        renderizarClientes();
    }
}

window.mudarMesRelatorio = (novoMes) => {
    inputMes.value = novoMes;
    carregarDadosDoMes();
}

// ======================================================
// 3. NAVEGAÇÃO
// ======================================================

window.mostrarTela = (telaId) => {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(telaId).classList.add('ativa');
    const index = telaId === 'clientes' ? 0 : telaId === 'agenda' ? 1 : 2;
    document.querySelectorAll('.main-nav button')[index].classList.add('active');
}

// ======================================================
// 4. MÓDULO DE CLIENTES (COM BOTÃO WPP)
// ======================================================

window.filtrarClientes = (tipo) => {
    filtroAtualClientes = tipo;
    document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
    if (tipo === 'todos') document.getElementById('btnFiltroTodos').classList.add('active');
    if (tipo === 'pendente') document.getElementById('btnFiltroPendente').classList.add('active');
    if (tipo === 'pago') document.getElementById('btnFiltroPago').classList.add('active');
    renderizarClientes();
}

window.renderizarClientes = () => {
    const mes = inputMes.value;
    const termo = document.getElementById('inputBusca').value.toLowerCase();
    const tbody = document.getElementById('tabelaClientes').querySelector('tbody');
    tbody.innerHTML = '';

    // PERMISSÕES
    const isAdmin = auth.currentUser.email === EMAIL_ADMIN;
    const isEstagiario = auth.currentUser.email === EMAIL_ESTAGIARIO;
    const podeEditar = isAdmin || isEstagiario;
    const disabled = podeEditar ? '' : 'disabled';

    let countTotal = 0;
    let countPendentes = 0;
    let totalRecebido = 0;

    listaClientes.sort((a, b) => a.nome.localeCompare(b.nome));

    listaClientes.forEach(cliente => {
        const dados = dbPagamentos[cliente.id] || { status: 'pendente', forma: '', valor: '' };

        countTotal++;
        if (dados.status === 'pendente') countPendentes++;
        if (dados.status === 'pago') totalRecebido += Number(dados.valor || 0);

        // Filtros
        if (termo && !cliente.nome.toLowerCase().includes(termo)) return;
        if (filtroAtualClientes === 'pendente' && dados.status !== 'pendente') return;
        if (filtroAtualClientes === 'pago' && dados.status !== 'pago') return;

        // --- AQUI ESTÁ A MUDANÇA (WPP) ---
        const zapLimpo = cliente.telefone.replace(/\D/g, '');
        const linkWpp = `https://wa.me/55${zapLimpo}?text=Olá ${cliente.nome}, referente à mensalidade...`;

        let htmlRecibo = "";
        if (dados.status === 'pago' && isAdmin) {
            const msgRecibo = `Confirmo recebimento de R$ ${Number(dados.valor).toFixed(2)} ref. ${mes}.`;
            const linkRecibo = `https://wa.me/55${zapLimpo}?text=${encodeURIComponent(msgRecibo)}`;
            htmlRecibo = `<br><a href="${linkRecibo}" target="_blank" class="btn-recibo">📄 RECIBO</a>`;
        }

        let estiloSelect = dados.status === 'pago'
            ? "background-color: #064e3b; color: #34d399; border: 1px solid #059669; font-weight: bold;"
            : "background-color: #451a03; color: #fbbf24; border: 1px solid #d97706;";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong style="color: var(--text-primary); text-transform:uppercase;">${cliente.nome}</strong><br>
                <small style="color: var(--text-secondary);">${cliente.telefone}</small>
                <a href="${linkWpp}" target="_blank" class="btn-zap">WPP</a>
            </td>
            <td>
                <select onchange="atualizarPagamento('${cliente.id}', 'status', this.value)" style="${estiloSelect}" ${disabled}>
                    <option value="pendente" ${dados.status === 'pendente' ? 'selected' : ''}>⏳ PENDENTE</option>
                    <option value="pago" ${dados.status === 'pago' ? 'selected' : ''}>✅ PAGO</option>
                </select>
                ${htmlRecibo}
            </td>
            <td>
                <select onchange="atualizarPagamento('${cliente.id}', 'forma', this.value)" ${disabled}>
                    <option value="" disabled ${!dados.forma ? 'selected' : ''}>...</option>
                    <option value="pix" ${dados.forma === 'pix' ? 'selected' : ''}>PIX</option>
                    <option value="dinheiro" ${dados.forma === 'dinheiro' ? 'selected' : ''}>DINHEIRO</option>
                    <option value="cartao" ${dados.forma === 'cartao' ? 'selected' : ''}>CARTÃO</option>
                </select>
            </td>
            <td>
                <input type="number" value="${dados.valor}" placeholder="0.00" onchange="atualizarPagamento('${cliente.id}', 'valor', this.value)" ${disabled}>
            </td>
            <td>
                <button class="btn-prontuario" onclick="abrirProntuario('${cliente.id}')">📋</button>
                <button class="btn-acao btn-editar" onclick="editarCliente('${cliente.id}')">✏️</button>
                <button class="btn-acao btn-excluir" onclick="removerCliente('${cliente.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (isAdmin) {
        document.getElementById('statTotal').innerText = countTotal;
        document.getElementById('statPendentes').innerText = countPendentes;
        document.getElementById('statRecebido').innerText = `R$ ${totalRecebido.toFixed(0)}`;

        const cardPend = document.querySelector('.stat-card.pendente .value');
        if (cardPend) cardPend.style.color = countPendentes > 0 ? 'var(--danger)' : 'var(--text-primary)';
    } else {
        document.getElementById('statTotal').innerText = countTotal;
        document.getElementById('statPendentes').innerText = countPendentes;
        document.getElementById('statRecebido').innerText = "R$ ***";
    }
}

// CRUD Clientes
window.salvarOuAtualizarCliente = async () => {
    const idEdicao = document.getElementById('idClienteEditando').value;
    const nome = document.getElementById('nomeCliente').value.trim();
    const telefone = document.getElementById('telefoneCliente').value.trim();
    if (!nome) return alert("Nome é obrigatório!");
    try {
        if (idEdicao) {
            await updateDoc(doc(db, "clientes", idEdicao), { nome, telefone });
            window.cancelarEdicao();
        } else {
            await addDoc(collection(db, "clientes"), { nome, telefone });
        }
        document.getElementById('nomeCliente').value = '';
        document.getElementById('telefoneCliente').value = '';
    } catch (e) { console.error(e); alert("Erro ao salvar."); }
}
window.editarCliente = (id) => {
    const cliente = listaClientes.find(c => c.id === id);
    if (cliente) {
        document.getElementById('nomeCliente').value = cliente.nome;
        document.getElementById('telefoneCliente').value = cliente.telefone;
        document.getElementById('idClienteEditando').value = cliente.id;
        document.getElementById('btnSalvarCliente').innerText = "💾 ATUALIZAR";
        document.getElementById('btnSalvarCliente').style.backgroundColor = "#D97706";
        document.getElementById('btnCancelarEdicao').style.display = "inline-block";
        document.getElementById('tituloFormCliente').innerText = "EDITANDO:";
    }
}
window.cancelarEdicao = () => {
    document.getElementById('idClienteEditando').value = "";
    document.getElementById('nomeCliente').value = "";
    document.getElementById('telefoneCliente').value = "";
    document.getElementById('btnSalvarCliente').innerText = "+ ADICIONAR";
    document.getElementById('btnSalvarCliente').style.backgroundColor = "";
    document.getElementById('btnCancelarEdicao').style.display = "none";
    document.getElementById('tituloFormCliente').innerText = "CADASTRAR NOVO ALUNO:";
}
window.removerCliente = async (id) => {
    if (confirm("Excluir cliente?")) await deleteDoc(doc(db, "clientes", id));
}

// Atualização de Pagamento
window.atualizarPagamento = async (clienteId, campo, valor) => {
    const isAdmin = auth.currentUser.email === EMAIL_ADMIN;
    const isEstagiario = auth.currentUser.email === EMAIL_ESTAGIARIO;

    if (!isAdmin && !isEstagiario) return alert("Sem permissão.");

    const mes = inputMes.value;
    const docId = `${mes}_${clienteId}`;
    const ref = doc(db, "pagamentos", docId);
    try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
            await updateDoc(ref, { [campo]: valor });
        } else {
            let novo = { clienteId, mesReferencia: mes, status: 'pendente', forma: '', valor: '' };
            novo[campo] = valor;
            await setDoc(ref, novo);
        }
    } catch (e) { console.error(e); }
}

// ======================================================
// 5. MÓDULO FINANCEIRO (APENAS ADMIN)
// ======================================================

window.adicionarGasto = async () => {
    const desc = document.getElementById('descGasto').value;
    const valor = document.getElementById('valorGasto').value;
    const mes = inputMes.value;
    if (!desc || !valor) return alert("Preencha tudo!");
    await addDoc(collection(db, "gastos"), { desc, valor, mesReferencia: mes });
    document.getElementById('descGasto').value = '';
    document.getElementById('valorGasto').value = '';
}
window.removerGasto = async (id) => {
    if (confirm("Excluir despesa?")) await deleteDoc(doc(db, "gastos", id));
}
window.renderizarFinanceiro = () => {
    if (auth.currentUser.email !== EMAIL_ADMIN) return;

    const tbody = document.getElementById('tabelaGastos').querySelector('tbody');
    tbody.innerHTML = '';

    let despesas = 0;
    let receitaTotal = 0;
    let somaPix = 0;
    let somaDinheiro = 0;
    let somaCartao = 0;

    Object.values(dbPagamentos).forEach(p => {
        if (p.status === 'pago') {
            const valor = Number(p.valor || 0);
            receitaTotal += valor;
            if (p.forma === 'pix') somaPix += valor;
            else if (p.forma === 'dinheiro') somaDinheiro += valor;
            else if (p.forma === 'cartao') somaCartao += valor;
        }
    });

    dbGastos.forEach(g => {
        despesas += Number(g.valor);
        tbody.innerHTML += `<tr><td>${g.desc.toUpperCase()}</td><td style="color:var(--danger); font-weight:bold;">- R$ ${Number(g.valor).toFixed(2)}</td><td class="no-print"><button onclick="removerGasto('${g.id}')" class="btn-acao btn-excluir">🗑️</button></td></tr>`;
    });

    const lucro = receitaTotal - despesas;
    document.getElementById('dashReceita').innerText = `R$ ${receitaTotal.toFixed(2)}`;
    document.getElementById('dashDespesas').innerText = `R$ ${despesas.toFixed(2)}`;
    document.getElementById('dashLucro').innerText = `R$ ${lucro.toFixed(2)}`;

    const elLucro = document.getElementById('dashLucro');
    if (lucro > 0) elLucro.style.color = 'var(--success)';
    else if (lucro < 0) elLucro.style.color = 'var(--danger)';
    else elLucro.style.color = 'white';

    if (document.getElementById('totalPix')) {
        document.getElementById('totalPix').innerText = `R$ ${somaPix.toFixed(2)}`;
        document.getElementById('totalDinheiro').innerText = `R$ ${somaDinheiro.toFixed(2)}`;
        document.getElementById('totalCartao').innerText = `R$ ${somaCartao.toFixed(2)}`;
    }
}

// ======================================================
// 6. MÓDULO AGENDA
// ======================================================

window.mudarDia = (dia) => {
    diaAtualAgenda = dia;
    document.querySelectorAll('.btn-dia').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${dia}`).classList.add('active');
    renderizarAgenda();
}
window.renderizarAgenda = () => {
    const container = document.getElementById('containerAgenda');
    container.innerHTML = '';

    const termo = document.getElementById('buscaHorario').value.trim();
    const filtroStatus = document.getElementById('filtroOcupacao').value;

    const agendamentosDia = dbAgenda[diaAtualAgenda] || {};
    let encontrouAlgum = false;

    const horaAgora = new Date().getHours();

    horariosFuncionamento.forEach(horario => {
        const agendados = agendamentosDia[horario] || [];
        const temGente = agendados.length > 0;
        const lotado = agendados.length >= MAX_ALUNOS_POR_HORARIO;
        const horaCard = parseInt(horario.split(':')[0]);
        const ehAgora = horaCard === horaAgora;

        if (termo && !horario.includes(termo)) return;
        if (filtroStatus === 'ocupados' && !temGente) return;
        if (filtroStatus === 'livres' && lotado) return;

        encontrouAlgum = true;

        let htmlBolinhas = `<div class="indicadores-vaga ${lotado ? 'lotado' : ''}" title="${agendados.length}/${MAX_ALUNOS_POR_HORARIO} ocupados">`;
        for (let i = 0; i < MAX_ALUNOS_POR_HORARIO; i++) {
            let classe = i < agendados.length ? 'cheia' : '';
            htmlBolinhas += `<div class="bolinha ${classe}"></div>`;
        }
        htmlBolinhas += '</div>';

        let htmlAlunos = '';
        agendados.forEach((aluno, index) => {
            const obs = aluno.obs ? `<span class="aluno-obs">📝 ${aluno.obs}</span>` : '';
            let classeStatus = aluno.presenca === 'presente' ? "presente" : (aluno.presenca === 'falta' ? "falta" : "");

            htmlAlunos += `
                <div class="aluno-item ${classeStatus}">
                    <div style="flex:1;"><strong>${aluno.nome.toUpperCase()}</strong> ${obs}</div>
                    <div class="agenda-acoes">
                        <button onclick="marcarPresenca('${horario}', ${index}, 'presente')" class="btn-check" title="Veio">✅</button>
                        <button onclick="marcarPresenca('${horario}', ${index}, 'falta')" class="btn-check" title="Faltou">❌</button>
                        <button onclick="removerDaAgenda('${horario}', ${index})" class="btn-check" style="color:var(--danger);" title="Excluir">🗑️</button>
                    </div>
                </div>`;
        });

        let opcoes = '<option value="">SELECIONE...</option>';
        listaClientes.forEach(c => opcoes += `<option value="${c.id}|${c.nome}">${c.nome}</option>`);

        const card = document.createElement('div');
        card.className = `horario-card ${ehAgora ? 'agora' : ''}`;

        card.innerHTML = `
            <div class="horario-titulo">
                <span>${horario}</span>
                ${htmlBolinhas}
            </div>
            <div>
                ${htmlAlunos}
                ${!lotado ? `
                    <div class="controles-agenda">
                        <select id="sel-${horario}" style="flex:2;">${opcoes}</select>
                        <input type="text" id="obs-${horario}" placeholder="OBS" style="flex:1;">
                        <button onclick="agendar('${horario}')">AGENDAR</button>
                    </div>
                ` : `
                    <div style="text-align:center; padding:10px; background:var(--bg-input); border:1px solid var(--danger); color:var(--danger); font-weight:bold; font-family:var(--font-headline); margin-top:10px;">
                        ⛔ HORÁRIO LOTADO (8/8)
                    </div>
                `}
            </div>
        `;
        container.appendChild(card);
    });

    if (!encontrouAlgum) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color: var(--text-secondary);">
                <h3 style="font-family: var(--font-headline);">NENHUM HORÁRIO ENCONTRADO</h3>
                <p>Tente buscar outro horário (ex: "18").</p>
            </div>
        `;
    }
}
window.agendar = async (horario) => {
    const sel = document.getElementById(`sel-${horario}`);
    const obs = document.getElementById(`obs-${horario}`).value;
    if (!sel.value) return alert("Selecione um aluno!");
    const [id, nome] = sel.value.split('|');
    const diaRef = doc(db, "agenda", diaAtualAgenda);
    const snap = await getDoc(diaRef);
    let dados = snap.exists() ? snap.data() : {};
    if (!dados[horario]) dados[horario] = [];
    if (dados[horario].length >= MAX_ALUNOS_POR_HORARIO) return alert("Horário Lotado!");
    dados[horario].push({ id, nome, obs, presenca: null });
    await setDoc(diaRef, dados);
}
window.marcarPresenca = async (horario, index, status) => {
    const diaRef = doc(db, "agenda", diaAtualAgenda);
    const snap = await getDoc(diaRef);
    let dados = snap.data();
    dados[horario][index].presenca = dados[horario][index].presenca === status ? null : status;
    await updateDoc(diaRef, dados);
}
window.removerDaAgenda = async (horario, index) => {
    if (confirm("Remover da agenda?")) {
        const diaRef = doc(db, "agenda", diaAtualAgenda);
        const snap = await getDoc(diaRef);
        let dados = snap.data();
        dados[horario].splice(index, 1);
        await updateDoc(diaRef, dados);
    }
}
// Prontuários
window.abrirProntuario = async (id) => {
    const cliente = listaClientes.find(c => c.id === id);
    document.getElementById('tituloProntuario').innerText = `FICHA: ${cliente.nome.toUpperCase()}`;
    document.getElementById('idAlunoProntuario').value = id;
    const snap = await getDoc(doc(db, "prontuarios", id));
    document.getElementById('textoProntuario').value = snap.exists() ? snap.data().texto : "";
    document.getElementById('modalProntuario').classList.add('open');
}
window.fecharProntuario = () => document.getElementById('modalProntuario').classList.remove('open');
window.salvarProntuario = async () => {
    await setDoc(doc(db, "prontuarios", document.getElementById('idAlunoProntuario').value), { texto: document.getElementById('textoProntuario').value });
    alert("Prontuário salvo!"); window.fecharProntuario();
}
