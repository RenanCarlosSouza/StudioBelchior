/* ============================================================
   SISTEMA CARLINHOS 2.0 - VERSÃO CLOUD (FIREBASE)
   ============================================================ */

// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- SUA CONFIGURAÇÃO (COLE A SUA AQUI SE FOR DIFERENTE) ---
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

// --- CONFIGURAÇÃO DE ADMIN ---
const EMAIL_ADMIN = "rehsouzaofc17@gmail.com"; // <--- COLOQUE SEU E-MAIL AQUI

// --- VARIÁVEIS GLOBAIS ---
let listaClientes = [];
let dbPagamentos = {};
let dbGastos = [];
let dbAgenda = {};
let unsubscribeClientes = null;
let unsubscribePagamentos = null;
let unsubscribeGastos = null;
let unsubscribeAgenda = null;

const inputMes = document.getElementById('mesReferencia');
const hoje = new Date();
const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
if (inputMes) {
    inputMes.value = mesAtual;
    inputMes.addEventListener('change', carregarDadosDoMes);
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
        // Logado
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('appConteudo').style.display = 'block';

        // CONTROLE DE ACESSO AO FINANCEIRO (FRONT-END)
        const btnFinanceiro = document.querySelector("button[onclick=\"mostrarTela('financeiro')\"]");

        if (user.email === EMAIL_ADMIN) {
            btnFinanceiro.style.display = "inline-block"; // Mostra botão
        } else {
            btnFinanceiro.style.display = "none"; // Esconde botão
            // Se tentar acessar via código, joga pra agenda
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
    signInWithEmailAndPassword(auth, email, pass)
        .catch((error) => {
            document.getElementById('msgErroLogin').innerText = "Erro: Login inválido.";
            console.error(error);
        });
}

window.fazerLogout = () => {
    signOut(auth);
    location.reload(); // Recarrega para limpar memória
}

// ======================================================
// 2. LISTENERS (DADOS EM TEMPO REAL)
// ======================================================

function iniciarListenersEmTempoReal(user) {
    // Clientes e Agenda (Todos veem)
    unsubscribeClientes = onSnapshot(collection(db, "clientes"), (snapshot) => {
        listaClientes = [];
        snapshot.forEach((doc) => listaClientes.push({ id: doc.id, ...doc.data() }));
        renderizarClientes();
    });

    unsubscribeAgenda = onSnapshot(collection(db, "agenda"), (snapshot) => {
        dbAgenda = { segunda: {}, terca: {}, quarta: {}, quinta: {}, sexta: {} };
        snapshot.forEach((doc) => dbAgenda[doc.id] = doc.data());
        renderizarAgenda();
    });

    carregarDadosDoMes(user);
}

function carregarDadosDoMes(user = auth.currentUser) {
    const mes = inputMes.value;

    // Limpa listeners antigos
    if (unsubscribePagamentos) unsubscribePagamentos();
    if (unsubscribeGastos) unsubscribeGastos();

    // SEGURANÇA: Só baixa financeiro se for Admin
    if (user && user.email === EMAIL_ADMIN) {

        // Pagamentos
        const qPagamentos = query(collection(db, "pagamentos"), where("mesReferencia", "==", mes));
        unsubscribePagamentos = onSnapshot(qPagamentos, (snapshot) => {
            dbPagamentos = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                dbPagamentos[data.clienteId] = data;
            });
            renderizarClientes();
            renderizarFinanceiro();
        });

        // Gastos
        const qGastos = query(collection(db, "gastos"), where("mesReferencia", "==", mes));
        unsubscribeGastos = onSnapshot(qGastos, (snapshot) => {
            dbGastos = [];
            snapshot.forEach((doc) => dbGastos.push({ id: doc.id, ...doc.data() }));
            renderizarFinanceiro();
        });

    } else {
        // Se não for admin, limpa dados da memória
        dbPagamentos = {};
        dbGastos = [];
        renderizarClientes(); // Atualiza tela para mostrar status "Pendente" (sem erro)
    }
}

// ======================================================
// 3. FUNÇÕES GLOBAIS (INTERATIVIDADE)
// ======================================================

window.mostrarTela = (telaId) => {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(telaId).classList.add('ativa');
    const index = telaId === 'clientes' ? 0 : telaId === 'agenda' ? 1 : 2;
    document.querySelectorAll('.main-nav button')[index].classList.add('active');
}

// --- CLIENTES ---
window.salvarOuAtualizarCliente = async () => {
    const idEdicao = document.getElementById('idClienteEditando').value;
    const nome = document.getElementById('nomeCliente').value.trim();
    const telefone = document.getElementById('telefoneCliente').value.trim();

    if (!nome) return alert("Nome obrigatório!");

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
        document.getElementById('btnSalvarCliente').innerText = "💾 Atualizar";
        document.getElementById('btnSalvarCliente').style.backgroundColor = "#f59e0b";
        document.getElementById('btnCancelarEdicao').style.display = "inline-block";
        document.getElementById('tituloFormCliente').innerText = "Editando:";
    }
}

window.cancelarEdicao = () => {
    document.getElementById('idClienteEditando').value = "";
    document.getElementById('nomeCliente').value = "";
    document.getElementById('telefoneCliente').value = "";
    document.getElementById('btnSalvarCliente').innerText = "+ Salvar Aluno";
    document.getElementById('btnSalvarCliente').style.backgroundColor = "";
    document.getElementById('btnCancelarEdicao').style.display = "none";
    document.getElementById('tituloFormCliente').innerText = "Cadastrar Novo:";
}

window.removerCliente = async (id) => {
    if (confirm("Excluir cliente?")) await deleteDoc(doc(db, "clientes", id));
}

// --- PAGAMENTOS E RENDERIZAÇÃO ---
window.atualizarPagamento = async (clienteId, campo, valor) => {
    // BLOQUEIO VISUAL: Se não for admin, avisa e para.
    if (auth.currentUser.email !== EMAIL_ADMIN) return alert("Apenas Admin pode alterar pagamentos!");

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

window.renderizarClientes = () => {
    const mes = inputMes.value;
    const termo = document.getElementById('inputBusca').value.toLowerCase();
    const tbody = document.getElementById('tabelaClientes').querySelector('tbody');
    tbody.innerHTML = '';

    let totalRecebido = 0;
    listaClientes.sort((a, b) => a.nome.localeCompare(b.nome));

    listaClientes.forEach(cliente => {
        // Se não for admin, dbPagamentos estará vazio, então status vira 'pendente' (padrão)
        const dados = dbPagamentos[cliente.id] || { status: 'pendente', forma: '', valor: '' };

        if (dados.status === 'pago') totalRecebido += Number(dados.valor || 0);
        if (termo && !cliente.nome.toLowerCase().includes(termo)) return;

        const zapLimpo = cliente.telefone.replace(/\D/g, '');
        const linkWpp = `https://wa.me/55${zapLimpo}?text=Olá ${cliente.nome}, tudo bem?`;

        // Se for admin e estiver pago, mostra recibo
        let htmlRecibo = "";
        if (dados.status === 'pago' && auth.currentUser.email === EMAIL_ADMIN) {
            const msgRecibo = `Confirmo recebimento de R$ ${Number(dados.valor).toFixed(2)} ref. ${mes}.`;
            const linkRecibo = `https://wa.me/55${zapLimpo}?text=${encodeURIComponent(msgRecibo)}`;
            htmlRecibo = `<br><a href="${linkRecibo}" target="_blank" class="btn-recibo">📄 Recibo</a>`;
        }

        let estiloSelect = dados.status === 'pago'
            ? "background-color: #064e3b; color: #34d399; border: 1px solid #059669; font-weight: bold; border-radius: 6px;"
            : "background-color: #451a03; color: #fbbf24; border: 1px solid #d97706; border-radius: 6px;";

        // Se não for admin, desabilita os campos de pagamento visualmente
        const disabled = auth.currentUser.email !== EMAIL_ADMIN ? 'disabled' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong style="color: var(--text-primary);">${cliente.nome}</strong><br>
                <small style="color: var(--text-secondary);">${cliente.telefone}</small>
                <a href="${linkWpp}" target="_blank" class="btn-zap">📱</a>
            </td>
            <td>
                <select onchange="atualizarPagamento('${cliente.id}', 'status', this.value)" style="${estiloSelect}" ${disabled}>
                    <option value="pendente" ${dados.status === 'pendente' ? 'selected' : ''}>⏳ Pendente</option>
                    <option value="pago" ${dados.status === 'pago' ? 'selected' : ''}>✅ Pago</option>
                </select>
                ${htmlRecibo}
            </td>
            <td>
                <select onchange="atualizarPagamento('${cliente.id}', 'forma', this.value)" ${disabled}>
                    <option value="" disabled ${!dados.forma ? 'selected' : ''}>...</option>
                    <option value="pix" ${dados.forma === 'pix' ? 'selected' : ''}>Pix</option>
                    <option value="dinheiro" ${dados.forma === 'dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    <option value="cartao" ${dados.forma === 'cartao' ? 'selected' : ''}>Cartão</option>
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

    // Se não for admin, esconde o total da receita
    if (auth.currentUser.email === EMAIL_ADMIN) {
        document.getElementById('resumoMesClientes').innerHTML = `Receita: <strong style="color: var(--success);">R$ ${totalRecebido.toFixed(2)}</strong>`;
    } else {
        document.getElementById('resumoMesClientes').innerHTML = `<small>Modo Visualização (Sem Acesso Financeiro)</small>`;
    }
}

// --- FINANCEIRO (GASTOS) ---
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
    if (confirm("Excluir?")) await deleteDoc(doc(db, "gastos", id));
}

window.renderizarFinanceiro = () => {
    // Se cair aqui e não for admin, sai (segurança extra)
    if (auth.currentUser.email !== EMAIL_ADMIN) return;

    const tbody = document.getElementById('tabelaGastos').querySelector('tbody');
    tbody.innerHTML = '';
    let despesas = 0;
    let receita = 0;

    Object.values(dbPagamentos).forEach(p => { if (p.status === 'pago') receita += Number(p.valor || 0); });

    dbGastos.forEach(g => {
        despesas += Number(g.valor);
        tbody.innerHTML += `<tr><td>${g.desc}</td><td style="color:var(--danger);">- R$ ${Number(g.valor).toFixed(2)}</td><td><button onclick="removerGasto('${g.id}')" class="btn-acao btn-excluir">🗑️</button></td></tr>`;
    });

    const lucro = receita - despesas;
    document.getElementById('dashReceita').innerText = `R$ ${receita.toFixed(2)}`;
    document.getElementById('dashDespesas').innerText = `R$ ${despesas.toFixed(2)}`;
    document.getElementById('dashLucro').innerText = `R$ ${lucro.toFixed(2)}`;
    document.getElementById('dashLucro').style.color = lucro >= 0 ? 'white' : 'var(--danger)';
}

// --- PRONTUÁRIOS E AGENDA (Mesma lógica de antes) ---
window.abrirProntuario = async (id) => {
    const cliente = listaClientes.find(c => c.id === id);
    document.getElementById('tituloProntuario').innerText = `Ficha: ${cliente.nome}`;
    document.getElementById('idAlunoProntuario').value = id;
    const snap = await getDoc(doc(db, "prontuarios", id));
    document.getElementById('textoProntuario').value = snap.exists() ? snap.data().texto : "";
    document.getElementById('modalProntuario').classList.add('open');
}
window.fecharProntuario = () => document.getElementById('modalProntuario').classList.remove('open');
window.salvarProntuario = async () => {
    await setDoc(doc(db, "prontuarios", document.getElementById('idAlunoProntuario').value), { texto: document.getElementById('textoProntuario').value });
    alert("Salvo!"); window.fecharProntuario();
}

window.mudarDia = (dia) => {
    diaAtualAgenda = dia;
    document.querySelectorAll('.btn-dia').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${dia}`).classList.add('active');
    renderizarAgenda();
}
window.renderizarAgenda = () => {
    const container = document.getElementById('containerAgenda');
    container.innerHTML = '';
    const agendamentosDia = dbAgenda[diaAtualAgenda] || {};
    horariosFuncionamento.forEach(horario => {
        const agendados = agendamentosDia[horario] || [];
        let htmlAlunos = '';
        agendados.forEach((aluno, index) => {
            const obs = aluno.obs ? `<span class="aluno-obs">📝 ${aluno.obs}</span>` : '';
            let classeStatus = aluno.presenca === 'presente' ? "presente" : (aluno.presenca === 'falta' ? "falta" : "");
            htmlAlunos += `
                <div class="aluno-item ${classeStatus}">
                    <div><strong>${aluno.nome}</strong> ${obs}</div>
                    <div class="agenda-acoes">
                        <button onclick="marcarPresenca('${horario}', ${index}, 'presente')" class="btn-check">✅</button>
                        <button onclick="marcarPresenca('${horario}', ${index}, 'falta')" class="btn-check">❌</button>
                        <button onclick="removerDaAgenda('${horario}', ${index})" class="btn-check" style="color:var(--danger);">🗑️</button>
                    </div>
                </div>`;
        });
        let opcoes = '<option value="">Selecione...</option>';
        listaClientes.forEach(c => opcoes += `<option value="${c.id}|${c.nome}">${c.nome}</option>`);
        const card = document.createElement('div');
        card.className = 'horario-card';
        card.innerHTML = `<div class="horario-titulo">${horario} <small>${agendados.length} alunos</small></div><div>${htmlAlunos}</div>
            <div class="controles-agenda"><select id="sel-${horario}" style="flex:2;">${opcoes}</select><input type="text" id="obs-${horario}" placeholder="Obs" style="flex:1;"><button onclick="agendar('${horario}')">Agendar</button></div>`;
        container.appendChild(card);
    });
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
    if (confirm("Remover?")) {
        const diaRef = doc(db, "agenda", diaAtualAgenda);
        const snap = await getDoc(diaRef);
        let dados = snap.data();
        dados[horario].splice(index, 1);
        await updateDoc(diaRef, dados);
    }
}