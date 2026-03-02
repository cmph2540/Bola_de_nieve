const byId = (id) => document.getElementById(id);
const fmtCOP = (v) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
}).format(v || 0);

let obligaciones = JSON.parse(localStorage.getItem('obligaciones') || '[]');

const entidadesBase = ["Bancolombia","Banco de Bogotá","Davivienda"];
const entidadSelect = byId('entidadSelect');

function cargarEntidades(){
  entidadSelect.innerHTML = "";
  entidadesBase.forEach(e=>{
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    entidadSelect.appendChild(opt);
  });
}

cargarEntidades();

byId('formObligacion').addEventListener('submit', (e)=>{
  e.preventDefault();

  const ob = {
    id: crypto.randomUUID(),
    entidad: entidadSelect.value,
    valorCredito: Number(byId('valorCredito').value),
    valorCuota: Number(byId('valorCuota').value),
    interesEA: Number(byId('interesEA').value),
    saldoActual: Number(byId('valorCredito').value)
  };

  obligaciones.push(ob);
  localStorage.setItem('obligaciones', JSON.stringify(obligaciones));
  renderObligaciones();
});

function renderObligaciones(){
  const cont = byId('listaObligaciones');
  cont.innerHTML = "";

  obligaciones.forEach(ob=>{
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <b>${ob.entidad}</b><br>
      Saldo: ${fmtCOP(ob.saldoActual)}<br>
      Cuota: ${fmtCOP(ob.valorCuota)}
    `;
    cont.appendChild(div);
  });
}

renderObligaciones();