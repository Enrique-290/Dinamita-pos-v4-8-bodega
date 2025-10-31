// DINÁMITA POS v4.8 (Bodega) – Clean build
// Simple store
const STORAGE_KEY='dinamita_pos_v48_bodega';
const SCHEMA_VERSION=9;

const DEFAULT_SETTINGS = {
  iva: 0, // default 0
  mensaje: 'Gracias por tu compra en Dinamita Gym 💥',
  logo: DEFAULT_LOGO,
  theme: { bg:'#ffffff', panel:'#fafafa', menu:'#f6f6f6', primary:'#d00', text:'#111111', sub:'#666666', border:'#e5e5e5' },
  negocio: { nombre:'DINAMITA GYM', direccion:'', telefono:'', email:'', redes:'' },
  tiposMembresia: [
    {nombre:'Visita', dias:0, precio:50},
    {nombre:'Semana', dias:7, precio:200},
    {nombre:'Mensualidad', dias:30, precio:350},
    {nombre:'2 Meses', dias:60, precio:600},
    {nombre:'6 Meses', dias:182, precio:1500},
    {nombre:'12 Meses', dias:365, precio:2700},
    {nombre:'Promo 2x$500', dias:30, precio:500}
  ]
};

const DB={
  load(){
    let raw=localStorage.getItem(STORAGE_KEY);
    if(raw){
      try{
        let d=JSON.parse(raw);
        if(!d.schemaVersion||d.schemaVersion<SCHEMA_VERSION)d=this.migrate(d);
        return d;
      }catch(e){}
    }
    let d=this.seed(); this.save(d); return d;
  },
  save(d){ localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); },
  seed(){
    return {
      schemaVersion:SCHEMA_VERSION,
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      products:[
        {sku:'WHEY-CH-900',nombre:'Proteína Whey Chocolate 900g',categoria:'Suplementos',precio:499,costo:300,stock:12,descr:''},
        {sku:'SHAKER-700',nombre:'Shaker Dinamita 700ml',categoria:'Accesorios',precio:149,costo:80,stock:25,descr:''}
      ],
      customers:[{id:'C1',nombre:'Público General',tel:'',email:'',certificadoMedico:false,entrenaSolo:false}],
      memberships:[],
      sales:[],
      warehouseMovements:[] // Bodega
    };
  },
  migrate(d){
    d=d||{};
    d.schemaVersion=SCHEMA_VERSION;
    d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings||{});
    d.products=(d.products||[]).map(p=>({stock:0,costo:0,descr:'',categoria:'General',img:p.img||'',...p}));
    d.customers=(d.customers||[]).map(c=>({certificadoMedico:false,entrenaSolo:false,...c}));
    d.memberships=d.memberships||[];
    d.sales=(d.sales||[]).map(s=>({...s,subtotalCosto:s.subtotalCosto??(s.items||[]).reduce((a,i)=>a+(i.costo||0)*(i.qty||0),0)}));
    d.warehouseMovements=d.warehouseMovements||[];
    return d;
  }
};

let state=DB.load();

// Helpers
function esc(x){return (x||'').replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));}
function money(n){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0)}
function padRight(t,n){return (t+' '.repeat(n)).slice(0,n);}
function padLeft(t,n){return (' '.repeat(n)+t).slice(-n);}
function repeat(ch,n){return new Array(n+1).join(ch);}
function truncate(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+'…':s;}
function center(t){const w=32;const p=Math.max(0,Math.floor((w-t.length)/2));return ' '.repeat(p)+t;}

function setCssVars(){
  const th=state.settings.theme;
  const r=document.documentElement;
  r.style.setProperty('--bg',th.bg);
  r.style.setProperty('--panel',th.panel);
  r.style.setProperty('--menu',th.menu);
  r.style.setProperty('--primary',th.primary);
  r.style.setProperty('--text',th.text);
  r.style.setProperty('--sub',th.sub);
  r.style.setProperty('--border',th.border);
}

const UI={
  init(){
    setCssVars();
    document.querySelectorAll('.menu button').forEach(b=>b.onclick=()=>{
      document.querySelectorAll('.menu button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      UI.show(b.dataset.view);
      document.getElementById('viewTitle').textContent=b.textContent.replace(/^[^ ]+ /,'');
    });
    document.getElementById('backupBtn').onclick=Backup.export;
    document.getElementById('restoreBtn').onclick=()=>document.getElementById('restoreInput').click();
    document.getElementById('restoreInput').addEventListener('change',Backup.importFile);

    Ventas.init();
    Dashboard.init();
    Inventario.renderTabla();
    Clientes.renderTabla();
    Historial.renderTabla();
    Reportes.init();
    Config.render();
    Tickets.updateHeader();
    Bodega.renderTabla();
    UI.show('dashboard');
  },
  show(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
    document.getElementById('view-'+id).classList.remove('hidden');
    if(id==='dashboard'){Dashboard.render();}
    if(id==='reportes'){Reportes.renderAll();}
    if(id==='bodega'){Bodega.renderTabla();}
    if(id==='membresias'){Membresias.renderTipos(); Membresias.renderTabla();}
  }
};

const Backup={
  export(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dinamita-pos-respaldo.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  },
  importFile(ev){
    const f=ev.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=e=>{try{
      let d=JSON.parse(e.target.result);
      if(!d.schemaVersion||d.schemaVersion<SCHEMA_VERSION)d=DB.migrate(d);
      state=d; DB.save(state); UI.init(); alert('Respaldo importado.');
    }catch(_){alert('Archivo inválido.');}};
    r.readAsText(f); ev.target.value='';
  }
};

// Dashboard & Charts (minimal)
const Dashboard={
  init(){
    const t=new Date().toISOString().slice(0,10);
    const ini=document.getElementById('dashIni'); const fin=document.getElementById('dashFin');
    ini.value=t; fin.value=t;
    ini.onchange=Dashboard.render; fin.onchange=Dashboard.render;
    document.getElementById('dashExportCsv').onclick=Dashboard.exportCsv;
    document.getElementById('dashExportPng').onclick=Dashboard.exportPng;
  },
  _filterSales(){
    const ini=document.getElementById('dashIni').value||'0000-01-01';
    const fin=document.getElementById('dashFin').value||'9999-12-31';
    return state.sales.filter(s=>{const f=s.fecha.slice(0,10); return f>=ini && f<=fin;});
  },
  render(){
    const today=new Date().toISOString().slice(0,10);
    const ventasHoy=state.sales.filter(s=>s.fecha.slice(0,10)===today);
    const totalHoy=ventasHoy.reduce((a,s)=>a+s.total,0);
    const utilidad=ventasHoy.reduce((a,s)=>a+((s.total-s.iva)-(s.subtotalCosto||0)),0);
    document.getElementById('kpiVentasHoy').textContent=money(totalHoy);
    document.getElementById('kpiTickets').textContent=String(ventasHoy.length);
    document.getElementById('kpiStock').textContent=String(state.products.reduce((a,p)=>a+(p.stock||0),0));
    document.getElementById('kpiGananciaHoy').textContent=money(utilidad);

    Charts.line(document.getElementById('chartVentas'), Charts.salesByDay(Dashboard._filterSales()));
    Charts.barH(document.getElementById('chartProductos'), Charts.topProducts(Dashboard._filterSales(),10));
  },
  exportCsv(){
    const rows=[['Folio','Fecha','Cliente','Items','Total','IVA','Costo','Ganancia']]
      .concat(state.sales.map(s=>[s.folio,s.fecha,(state.customers.find(c=>c.id===s.cliente)?.nombre||''),s.items.map(i=>`${i.nombre} x${i.qty}`).join('; '),s.total,s.iva,(s.subtotalCosto||0),((s.total-s.iva)-(s.subtotalCosto||0))]));
    downloadCSV('dashboard_ventas.csv',rows);
  },
  exportPng(){
    const c=document.getElementById('chartVentas');
    const a=document.createElement('a'); a.href=c.toDataURL('image/png'); a.download='grafica_ventas.png'; a.click();
  }
};

const Charts={
  clear(ctx){ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);},
  setup(canvas){if(!canvas)return null;canvas.width=canvas.clientWidth; canvas.height=280; const ctx=canvas.getContext('2d'); this.clear(ctx); return ctx;},
  line(canvas, data){
    const ctx=this.setup(canvas); if(!ctx)return;
    const padding=30; const w=ctx.canvas.width, h=ctx.canvas.height;
    const xs=data.map(d=>d.x), ys=data.map(d=>d.y);
    const maxY=Math.max(1,...ys);
    ctx.strokeStyle='#bbb'; ctx.beginPath();
    ctx.moveTo(padding, h-padding); ctx.lineTo(w-padding, h-padding);
    ctx.moveTo(padding, h-padding); ctx.lineTo(padding, padding); ctx.stroke();
    ctx.strokeStyle='#d00'; ctx.beginPath();
    xs.forEach((x,i)=>{
      const px=padding + (i*(w-2*padding)/Math.max(1,xs.length-1));
      const py=h-padding - (ys[i]/maxY)*(h-2*padding);
      if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py);
    });
    ctx.stroke();
  },
  barH(canvas, data){
    const ctx=this.setup(canvas); if(!ctx)return;
    const padding=10; const w=ctx.canvas.width, h=ctx.canvas.height;
    const maxY=Math.max(1,...data.map(d=>d.v));
    const barH= Math.min(28, (h-2*padding)/Math.max(1,data.length));
    ctx.font='12px system-ui, Arial';
    data.forEach((d,i)=>{
      const y=padding + i*barH + 4;
      const bw=((w-160)*d.v/maxY);
      ctx.fillStyle='#d00'; ctx.fillRect(150, y, bw, barH-8);
      ctx.fillStyle='#333'; ctx.fillText(truncate(d.k,18), 10, y+barH/2+4);
      ctx.fillText(String(d.v), 150+bw+6, y+barH/2+4);
    });
  },
  salesByDay(sales){
    const by={}; sales.forEach(s=>{const d=s.fecha.slice(0,10); by[d]=(by[d]||0)+s.total;});
    const keys=Object.keys(by).sort(); return keys.map(k=>({x:k,y:by[k]}));
  },
  topProducts(sales,n){
    const by={};
    sales.forEach(s=>s.items.forEach(i=>{ if(!i.nombre.startsWith('Membresía')) by[i.nombre]=(by[i.nombre]||0)+i.qty; }));
    return Object.entries(by).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v).slice(0,n);
  }
};

// Ventas (incluye membresías desde aquí, sin sección aparte)
const Ventas={
  carrito:[],
  tipo:'producto',
  init(){
    this.fillTiposMembresia();
    this.changeTipo();
    this.searchCliente(''); // preload
  },
  changeTipo(){
    this.tipo=document.getElementById('ventaTipo').value;
    document.getElementById('ventaProductoBox').classList.toggle('hidden', this.tipo!=='producto');
    document.getElementById('ventaMembresiaBox').classList.toggle('hidden', this.tipo!=='membresia');
    this.renderCarrito();
    const t=new Date().toISOString().slice(0,10);
    const ini=document.getElementById('vMemInicio'); if(ini) ini.value=t;
    this.updateMemFin();
  },
  searchCliente(term){
    const box=document.getElementById('ventaClienteResults');
    term=(term||'').trim().toLowerCase();
    const res=state.customers.filter(c=>((c.nombre||'')+' '+(c.tel||'')+' '+(c.email||'')).toLowerCase().includes(term)).slice(0,30);
    if(!term){ box.classList.add('hidden'); box.innerHTML=''; return; }
    box.innerHTML=res.length?res.map(c=>`<div class="item" onclick="Ventas.pickCliente('${c.id}')"><div><strong>👤 ${esc(c.nombre||'')}</strong></div><div class="muted">📞 ${esc(c.tel||'')} · ✉️ ${esc(c.email||'')}</div></div>`).join(''):`<div class="item"><span class="muted">Sin coincidencias</span></div>`;
    box.classList.remove('hidden');
  },
  pickCliente(id){
    const c=state.customers.find(x=>x.id===id); if(!c)return;
    document.getElementById('ventaCliente').value=c.id;
    document.getElementById('ventaClienteSearch').value=c.nombre||'Público General';
    document.getElementById('ventaClienteResults').classList.add('hidden');
  },
  buscarProducto(term){
    term=(term||'').toLowerCase();
    const res=state.products.filter(p=>p.nombre.toLowerCase().includes(term)||(p.sku||'').toLowerCase().includes(term));
    const wrap=document.getElementById('ventaResultados'); wrap.innerHTML='';
    res.forEach(p=>{
      const div=document.createElement('div'); div.className='list-item';
      div.innerHTML=`<img class="thumb" src="${esc(p.img||'')}" onerror="this.style.display='none'"/> <div style="flex:1"><div><strong>${esc(p.nombre)}</strong> <small>(${esc(p.sku)})</small></div><div class="sub">Precio: ${money(p.precio)} • Stock: ${p.stock}</div></div><div><input type="number" min="1" step="1" value="1" style="width:70px"> <button class="btn small">➕</button></div>`;
      div.querySelector('button').onclick=()=>{const qty=parseInt(div.querySelector('input').value||'1',10); Ventas.addCarrito(p.sku,qty)};
      wrap.appendChild(div);
    });
  },
  addCarrito(sku,qty){
    const p=state.products.find(x=>x.sku===sku); if(!p)return;
    const e=Ventas.carrito.find(x=>x.sku===sku && !x._isService);
    if(e) e.qty+=qty; else Ventas.carrito.push({sku,nombre:p.nombre,precio:p.precio,qty});
    Ventas.renderCarrito();
  },
  fillTiposMembresia(){
    const sel=document.getElementById('vMemTipo'); if(!sel) return;
    sel.innerHTML='';
    (state.settings.tiposMembresia||[]).forEach(t=>{
      const o=document.createElement('option'); o.value=t.nombre; o.textContent=`${t.nombre} (${money(t.precio)})`; sel.appendChild(o);
    });
    this.updateMemFin();
  },
  updateMemFin(){
    const sel=document.getElementById('vMemTipo'); if(!sel) return;
    const tipo=sel.value;
    const tinfo=(state.settings.tiposMembresia||[]).find(t=>t.nombre===tipo) || {dias:0};
    const ini=document.getElementById('vMemInicio').value || new Date().toISOString().slice(0,10);
    const d=new Date(ini); d.setDate(d.getDate() + (tinfo.dias||0));
    document.getElementById('vMemFin').value = d.toISOString().slice(0,10);
  },
  addMembresia(){
    const tipo = document.getElementById('vMemTipo').value;
    const inicio = document.getElementById('vMemInicio').value;
    const fin = document.getElementById('vMemFin').value;
    if(!document.getElementById('ventaCliente').value || document.getElementById('ventaCliente').value==='C1'){
      alert('Selecciona un cliente (no Público General) para membresía.'); return;
    }
    const tinfo = (state.settings.tiposMembresia||[]).find(t=>t.nombre===tipo) || {precio:0};
    const nombre = 'Membresía '+tipo;
    const e=Ventas.carrito.find(x=>x._isService && x.nombre===nombre);
    if(e){ alert('Ya agregaste esta membresía.'); return; }
    Ventas.carrito.push({_isService:true,nombre,precio: tinfo.precio, qty:1, mem:{tipo,inicio,fin}});
    Ventas.renderCarrito();
  },
  renderCarrito(){
    const c=document.getElementById('carrito'); if(!c) return;
    c.innerHTML='';
    Ventas.carrito.forEach((i,idx)=>{
      const div=document.createElement('div'); div.className='list-item';
      div.innerHTML=`<div style="flex:1"><div><strong>${esc(i.nombre)}</strong></div><div class="sub">${i._isService?'Servicio de membresía':'Producto'} · ${money(i.precio)} x ${i.qty}</div></div><div><button class="btn small" onclick="Ventas.delItem(${idx})">✕</button></div>`;
      c.appendChild(div);
    });
    Ventas.updateTotals();
  },
  delItem(idx){Ventas.carrito.splice(idx,1); Ventas.renderCarrito();},
  updateTotals(){
    const sub=Ventas.carrito.reduce((a,i)=>a+i.precio*i.qty,0);
    const ivaPct=state.settings.iva||0;
    const iva=sub*(ivaPct/100);
    const total=sub+iva;
    const sb=document.getElementById('ventaSubtotal'); if(sb) sb.textContent=money(sub);
    const iv=document.getElementById('ventaIVA'); if(iv) iv.textContent=money(iva);
    const tt=document.getElementById('ventaTotal'); if(tt) tt.textContent=money(total);
    return {subtotal:sub,iva,total};
  },
  confirmar(){
    if(Ventas.carrito.length===0){alert('Agrega productos o membresías.');return;}
    for(const it of Ventas.carrito){
      if(!it._isService){
        const p=state.products.find(x=>x.sku===it.sku);
        if(!p||p.stock<it.qty){alert('Stock insuficiente de '+it.nombre);return;}
      }
    }
    Ventas.carrito.forEach(it=>{ if(!it._isService){ const p=state.products.find(x=>x.sku===it.sku); p.stock-=it.qty; }});
    const cliente=document.getElementById('ventaCliente').value || 'C1';
    const totals=Ventas.updateTotals();
    const folio='T'+Date.now().toString().slice(-8);
    const items=Ventas.carrito.map(it=>{
      if(it._isService){
        return {sku:'SERV-MEM', nombre:it.nombre, precio:it.precio, costo:0, qty:it.qty, _isService:true, mem:it.mem};
      }else{
        const prod=state.products.find(x=>x.sku===it.sku);
        return {sku:it.sku,nombre:it.nombre,precio:it.precio,costo:prod?.costo||0,qty:it.qty};
      }
    });
    const venta={folio,fecha:new Date().toISOString(),items,subtotal:totals.subtotal,iva:totals.iva,total:totals.total,cliente,notas:state.settings.mensaje||''};
    venta.subtotalCosto=items.reduce((a,i)=>a+(i.costo||0)*i.qty,0);
    venta.ganancia=(venta.total-venta.iva)-venta.subtotalCosto;
    state.sales.unshift(venta); DB.save(state);

    // registrar membresías vendidas
    items.filter(i=>i._isService && i.mem).forEach(i=>{
      const id='M'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      state.memberships.unshift({id,cliente,tipo:i.mem.tipo,inicio:i.mem.inicio,fin:i.mem.fin,notas:'(Desde Ventas)'});
    });
    DB.save(state);

    Ventas.carrito=[];
    Ventas.renderCarrito();
    Dashboard.render();
    Inventario.renderTabla();
    Historial.renderTabla();
    Tickets.render(venta);
    UI.show('ticket');
  }
};

const Inventario={
  loadImg(input){
    const f=input.files && input.files[0]; if(!f){document.getElementById('prodImgPreview').src=''; return;}
    const r=new FileReader(); r.onload=e=>{document.getElementById('prodImgPreview').src=e.target.result; document.getElementById('prodImgPreview').dataset.dataUrl=e.target.result;}; r.readAsDataURL(f);
  },

  limpiar(){['prodSku','prodNombre','prodCategoria','prodPrecio','prodCosto','prodStock','prodDescr'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});},
  guardar(){
    const sku=document.getElementById('prodSku').value.trim();
    const nombre=document.getElementById('prodNombre').value.trim();
    if(!sku||!nombre){alert('SKU y Nombre obligatorios.');return;}
    const img=(document.getElementById('prodImgPreview').dataset.dataUrl||document.getElementById('prodImgPreview').src||'');
    const p={sku,nombre,categoria:(document.getElementById('prodCategoria').value||'').trim()||'General',precio:parseFloat(document.getElementById('prodPrecio').value||'0'),costo:parseFloat(document.getElementById('prodCosto').value||'0'),stock:parseInt(document.getElementById('prodStock').value||'0',10),descr:(document.getElementById('prodDescr').value||'').trim(),img};
    let ex=state.products.find(x=>x.sku===sku); if(ex)Object.assign(ex,p); else state.products.unshift(p);
    DB.save(state); this.renderTabla(); alert('Producto guardado.');
  },
  renderTabla(){
    const q=(document.getElementById('invSearch').value||'').toLowerCase();
    const cat=(document.getElementById('invCat').value||'').toLowerCase();
    const rows=state.products.filter(p=>{
      const okQ=p.nombre.toLowerCase().includes(q)||(p.sku||'').toLowerCase().includes(q);
      const okC=!cat||(p.categoria||'').toLowerCase()===cat;
      return okQ&&okC;
    }).map(p=>{
      const badge=p.stock>5?'<span class="badge ok">✅ OK</span>':p.stock>0?'<span class="badge warn">⚠️ Bajo</span>':'<span class="badge bad">⛔ Agotado</span>';
      return `<tr><td>${esc(p.sku)}</td><td><div style='display:flex;gap:8px;align-items:center'><img class='thumb' src='${esc(p.img||'')}' onerror="this.style.display='none'"/><div>${esc(p.nombre)}</div></div></td><td>${esc(p.categoria||'')}</td><td>${money(p.precio)}</td><td>${money(p.costo||0)}</td><td>${p.stock} ${badge}</td><td><button class="btn small" onclick="Inventario.edit('${p.sku}')">✏️</button> <button class="btn small danger" onclick="Inventario.del('${p.sku}')">🗑️</button></td></tr>`;
    }).join('');
    document.getElementById('invTabla').innerHTML=`<table><thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="7">Sin productos</td></tr>'}</tbody></table>`;
  },
  edit(sku){
    const p=state.products.find(x=>x.sku===sku); if(!p)return;
    document.getElementById('prodSku').value=p.sku;
    document.getElementById('prodNombre').value=p.nombre;
    document.getElementById('prodCategoria').value=p.categoria||'';
    document.getElementById('prodPrecio').value=p.precio;
    document.getElementById('prodCosto').value=p.costo||0;
    document.getElementById('prodStock').value=p.stock;
    document.getElementById('prodDescr').value=p.descr||'';
    const prev=document.getElementById('prodImgPreview'); prev.src=p.img||''; prev.dataset.dataUrl=p.img||'';
    window.scrollTo({top:0,behavior:'smooth'});
  },
  del(sku){if(!confirm('¿Eliminar producto?'))return; state.products=state.products.filter(x=>x.sku!==sku); DB.save(state); this.renderTabla();},
  exportCSV(){const rows=[['SKU','Nombre','Categoría','Precio','Costo','Stock']].concat(state.products.map(p=>[p.sku,p.nombre,p.categoria||'',p.precio,p.costo||0,p.stock])); downloadCSV('inventario.csv',rows);}
};

const Clientes={
  limpiar(){['cliId','cliNombre','cliTel','cliEmail'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});document.getElementById('cliCertMed').checked=false;document.getElementById('cliEntrenaSolo').checked=false;},
  guardar(){
    const idEdit=(document.getElementById('cliId').value||'').trim();
    const nombre=document.getElementById('cliNombre').value.trim();
    if(!nombre){alert('Nombre obligatorio.');return;}
    const tel=document.getElementById('cliTel').value.trim();
    const email=document.getElementById('cliEmail').value.trim();
    const certificadoMedico=document.getElementById('cliCertMed').checked;
    const entrenaSolo=document.getElementById('cliEntrenaSolo').checked;
    let c;
    if(idEdit){
      c=state.customers.find(x=>x.id===idEdit); if(!c){alert('Cliente no encontrado');return;}
      Object.assign(c,{nombre,tel,email,certificadoMedico,entrenaSolo});
    }else{
      const id='C'+Date.now().toString(36); c={id,nombre,tel,email,certificadoMedico,entrenaSolo}; state.customers.unshift(c);
    }
    DB.save(state); this.renderTabla(); Ventas.searchCliente(''); this.limpiar(); alert('Cliente guardado.');
  },
  edit(id){
    const c=state.customers.find(x=>x.id===id); if(!c)return;
    document.getElementById('cliId').value=c.id;
    document.getElementById('cliNombre').value=c.nombre||'';
    document.getElementById('cliTel').value=c.tel||'';
    document.getElementById('cliEmail').value=c.email||'';
    document.getElementById('cliCertMed').checked=!!c.certificadoMedico;
    document.getElementById('cliEntrenaSolo').checked=!!c.entrenaSolo;
    window.scrollTo({top:0,behavior:'smooth'});
  },
  del(id){
    const c=state.customers.find(x=>x.id===id); if(!c)return;
    if(!confirm(`¿Eliminar "${c.nombre}"?`))return;
    state.customers=state.customers.filter(x=>x.id!==id);
    DB.save(state); this.renderTabla(); Ventas.searchCliente('');
  },
  renderTabla(){
    const q=(document.getElementById('cliSearch').value||'').toLowerCase();
    const rows=state.customers.filter(c=>(c.nombre||'').toLowerCase().includes(q)||(c.tel||'').toLowerCase().includes(q)||(c.email||'').toLowerCase().includes(q)).map(c=>{
      const cm=c.certificadoMedico?'<span class="badge ok">✅ Sí</span>':'<span class="badge bad">❌ No</span>';
      const es=c.entrenaSolo?'<span class="badge warn">🏋️‍♂️ Solo</span>':'<span class="badge ok">👥 Acomp.</span>';
      return `<tr><td>${esc(c.nombre)}</td><td>${esc(c.tel||'')}</td><td>${esc(c.email||'')}</td><td>${cm}</td><td>${es}</td><td><button class="btn small" onclick="Clientes.edit('${c.id}')">✏️</button> <button class="btn small danger" onclick="Clientes.del('${c.id}')">🗑️</button></td></tr>`;
    }).join('');
    document.getElementById('cliTabla').innerHTML=`<table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Cert. médico</th><th>Entrena</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6">Sin clientes</td></tr>'}</tbody></table>`;
  },
  exportCSV(){const rows=[['ID','Nombre','Telefono','Email','CertificadoMedico','EntrenaSolo']].concat(state.customers.map(c=>[c.id,c.nombre||'',c.tel||'',c.email||'',c.certificadoMedico?'SI':'NO',c.entrenaSolo?'SOLO':'ACOMPAÑADO']));downloadCSV('clientes.csv',rows);}
};

// BODEGA
const Bodega={
  _pickSku:null,
  buscarProducto(term){
    term=(term||'').toLowerCase();
    const wrap=document.getElementById('bodResultados'); wrap.innerHTML='';
    if(!term){return;}
    const res=state.products.filter(p=>p.nombre.toLowerCase().includes(term)||(p.sku||'').toLowerCase().includes(term)).slice(0,30);
    res.forEach(p=>{
      const div=document.createElement('div'); div.className='list-item';
      div.innerHTML=`<div style="flex:1"><div><strong>${esc(p.nombre)}</strong> <small>(${esc(p.sku)})</small></div><div class="sub">Stock: ${p.stock} · Costo: ${money(p.costo||0)}</div></div><div><button class="btn small">Seleccionar</button></div>`;
      div.querySelector('button').onclick=()=>{ document.getElementById('bodSku').value=p.sku; document.getElementById('bodSearch').value=p.nombre; wrap.innerHTML=''; };
      wrap.appendChild(div);
    });
  },
  aplicar(){
    const tipo=document.getElementById('bodTipo').value;
    const sku=document.getElementById('bodSku').value;
    const cant=parseInt(document.getElementById('bodCantidad').value||'0',10);
    const nuevoCosto=parseFloat(document.getElementById('bodCosto').value||'NaN');
    const nota=(document.getElementById('bodNota').value||'').trim();
    if(!sku){alert('Selecciona un producto.');return;}
    if(isNaN(cant) || cant<0){alert('Cantidad inválida');return;}
    const p=state.products.find(x=>x.sku===sku); if(!p){alert('Producto no encontrado');return;}
    const prev=p.stock||0;
    let newStock=prev;
    if(tipo==='Entrada'){ newStock=prev+cant; if(!isNaN(nuevoCosto)) p.costo=nuevoCosto; }
    else if(tipo==='Salida'){ if(prev<cant){alert('Stock insuficiente');return;} newStock=prev-cant; }
    else if(tipo==='Ajuste'){ newStock=cant; } // cantidad = nuevo stock
    p.stock=newStock;

    // Movement record
    const mov={
      id:'B'+Date.now().toString(36),
      fecha:new Date().toISOString(),
      tipo, sku, nombre:p.nombre, cantidad:cant, previo:prev, nuevo:newStock,
      costo:isNaN(nuevoCosto)?p.costo:nuevoCosto,
      nota
    };
    state.warehouseMovements.unshift(mov);
    DB.save(state);

    document.getElementById('bodCantidad').value='';
    document.getElementById('bodCosto').value='';
    document.getElementById('bodNota').value='';
    document.getElementById('bodSku').value='';
    document.getElementById('bodSearch').value='';
    Inventario.renderTabla();
    this.renderTabla();
    alert('Movimiento aplicado.');
  },
  renderTabla(){
    const q=(document.getElementById('bodFiltrar')?.value||'').toLowerCase();
    const rows=(state.warehouseMovements||[]).filter(m=>{
      const t=(m.sku+' '+m.nombre+' '+(m.nota||'')).toLowerCase();
      return t.includes(q);
    }).map(m=>`<tr>
      <td>${m.id}</td>
      <td>${m.fecha.slice(0,16).replace('T',' ')}</td>
      <td>${esc(m.tipo)}</td>
      <td>${esc(m.sku)}</td>
      <td>${esc(m.nombre)}</td>
      <td>${m.previo} → <strong>${m.nuevo}</strong></td>
      <td>${money(m.costo||0)}</td>
      <td>${esc(m.nota||'')}</td>
    </tr>`).join('');
    document.getElementById('bodTabla').innerHTML=`<table><thead><tr><th>ID</th><th>Fecha</th><th>Tipo</th><th>SKU</th><th>Producto</th><th>Stock</th><th>Costo</th><th>Nota</th></tr></thead><tbody>${rows||'<tr><td colspan="8">Sin movimientos</td></tr>'}</tbody></table>`;
  },
  exportCSV(){
    const rows=[['ID','Fecha','Tipo','SKU','Producto','Previo','Cantidad','Nuevo','Costo','Nota']]
      .concat((state.warehouseMovements||[]).map(m=>[m.id,m.fecha,m.tipo,m.sku,m.nombre,m.previo,m.cantidad,m.nuevo,m.costo||0,m.nota||'']));
    downloadCSV('bodega_movimientos.csv',rows);
  }
};

// Historial (ventas)
const Historial={
  openFiltros(){
    const m=document.getElementById('modalFiltros'); m.classList.remove('hidden'); m.setAttribute('aria-hidden','false');
    const escFn=e=>{if(e.key==='Escape'){Historial.closeFiltros();document.removeEventListener('keydown',escFn);}};
    document.addEventListener('keydown',escFn);
    m.addEventListener('click',e=>{if(e.target.id==='modalFiltros')Historial.closeFiltros();},{once:true});
  },
  closeFiltros(){const m=document.getElementById('modalFiltros'); m.classList.add('hidden'); m.setAttribute('aria-hidden','true');},
  applyFiltros(){this.renderTabla(); this.closeFiltros();},
  clearFiltros(){['histFechaIni','histFechaFin','histFolio','histCliente','histProducto'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});document.getElementById('histPago').value='';this.renderTabla();},
  renderTabla(){
    const ini=document.getElementById('histFechaIni')?.value||'';
    const fin=document.getElementById('histFechaFin')?.value||'';
    const folio=(document.getElementById('histFolio')?.value||'').toLowerCase();
    const clienteQ=(document.getElementById('histCliente')?.value||'').toLowerCase();
    const prodQ=(document.getElementById('histProducto')?.value||'').toLowerCase();
    const rows=state.sales.filter(s=>{
      const f=s.fecha.slice(0,10);
      if(ini&&f<ini)return false;
      if(fin&&f>fin)return false;
      if(folio&&!s.folio.toLowerCase().includes(folio))return false;
      const cliente=(state.customers.find(c=>c.id===s.cliente)?.nombre||'').toLowerCase();
      if(clienteQ&&!cliente.includes(clienteQ))return false;
      if(prodQ&&!s.items.map(i=>i.nombre).join(' ').toLowerCase().includes(prodQ))return false;
      return true;
    }).map(s=>{
      const cli=state.customers.find(c=>c.id===s.cliente)?.nombre||'';
      const itemsStr=s.items.map(i=>`${i.nombre} x${i.qty}`).join(', ');
      return `<tr><td>${esc(s.folio)}</td><td>${s.fecha.slice(0,16).replace('T',' ')}</td><td>${esc(cli)}</td><td>${esc(itemsStr)}</td><td>${money(s.total)}</td><td><button class='btn small' onclick="Tickets.renderByFolio('${s.folio}')">🖨️ Reimprimir</button></td></tr>`;
    }).join('');
    document.getElementById('histTabla').innerHTML=`<table><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6">Sin ventas</td></tr>'}</tbody></table>`;
  },
  exportCSV(){
    const rows=[['Folio','Fecha','Cliente','Items','Total','IVA','Costo','Ganancia']].concat(state.sales.map(s=>[s.folio,s.fecha,(state.customers.find(c=>c.id===s.cliente)?.nombre||''),s.items.map(i=>`${i.nombre} x${i.qty}`).join('; '),s.total,s.iva,(s.subtotalCosto||0),((s.total-s.iva)-(s.subtotalCosto||0))]));
    downloadCSV('historial_ventas.csv',rows);
  }
};

const Reportes={
  init(){ this.show('rep-ventas'); },
  show(id, el){
    document.querySelectorAll('#view-reportes .rep-pane').forEach(x=>x.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('#view-reportes .tab').forEach(x=>x.classList.remove('active'));
    if(el) el.classList.add('active');
    this.renderAll();
  },
  renderAll(){
    if(!document.getElementById('view-reportes') || document.getElementById('view-reportes').classList.contains('hidden')) return;
    this.renderVentas(); this.renderInventario(); this.renderTops();
  },
  renderVentas(){
    const ini=document.getElementById('repVenIni').value||'0000-01-01';
    const fin=document.getElementById('repVenFin').value||'9999-12-31';
    const rows=state.sales.filter(s=>{const f=s.fecha.slice(0,10); return f>=ini && f<=fin;});
    const total=rows.reduce((a,s)=>a+s.total,0);
    const gan=rows.reduce((a,s)=>a+((s.total-s.iva)-(s.subtotalCosto||0)),0);
    document.getElementById('repVenKpi').innerHTML = `
      <div class="card"><div class="card-title">Total ventas</div><div class="card-value">${money(total)}</div></div>
      <div class="card"><div class="card-title">Tickets</div><div class="card-value">${rows.length}</div></div>
      <div class="card"><div class="card-title">Ganancia</div><div class="card-value">${money(gan)}</div></div>`;
    const body=rows.map(s=>{
      const cli=state.customers.find(c=>c.id===s.cliente)?.nombre||'';
      const items=s.items.map(i=>`${i.nombre} x${i.qty}`).join('; ');
      return `<tr><td>${s.folio}</td><td>${s.fecha.slice(0,16).replace('T',' ')}</td><td>${esc(cli)}</td><td>${esc(items)}</td><td>${money(s.total)}</td></tr>`;
    }).join('');
    document.getElementById('repVenTabla').innerHTML=`<table><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total</th></tr></thead><tbody>${body||'<tr><td colspan="5">Sin registros</td></tr>'}</tbody></table>`;
  },
  exportVentas(){
    const ini=document.getElementById('repVenIni').value||'0000-01-01';
    const fin=document.getElementById('repVenFin').value||'9999-12-31';
    const rows=[['Folio','Fecha','Cliente','Items','Total']]
      .concat(state.sales.filter(s=>{const f=s.fecha.slice(0,10); return f>=ini && f<=fin;}).map(s=>[s.folio,s.fecha,(state.customers.find(c=>c.id===s.cliente)?.nombre||''),s.items.map(i=>`${i.nombre} x${i.qty}`).join('; '),s.total]));
    downloadCSV('reporte_ventas.csv', rows);
  },
  renderInventario(){
    const rows=state.products.map(p=>`<tr><td>${esc(p.sku)}</td><td>${esc(p.nombre)}</td><td>${esc(p.categoria||'')}</td><td>${money(p.precio)}</td><td>${money(p.costo||0)}</td><td>${p.stock}</td></tr>`).join('');
    document.getElementById('repInvTabla').innerHTML=`<table><thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Sin productos</td></tr>'}</tbody></table>`;
  },

  renderDetallado(){
    const ini=document.getElementById('repDetIni').value||'0000-01-01';
    const fin=document.getElementById('repDetFin').value||'9999-12-31';
    const q=(document.getElementById('repDetQ').value||'').toLowerCase();
    const lines=[];
    state.sales.forEach(s=>{
      const f=s.fecha.slice(0,10);
      if(f<ini || f>fin) return;
      const cliente=(state.customers.find(c=>c.id===s.cliente)?.nombre||'');
      s.items.forEach(i=>{
        const hay=(i.nombre.toLowerCase().includes(q) || cliente.toLowerCase().includes(q) || s.folio.toLowerCase().includes(q) || (i.sku||'').toLowerCase().includes(q));
        if(!hay) return;
        lines.push({folio:s.folio,fecha:s.fecha,cliente,sku:i.sku||'',producto:i.nombre,qty:i.qty,precio:i.precio,importe:i.qty*i.precio});
      });
    });
    const total=lines.reduce((a,l)=>a+l.importe,0);
    document.getElementById('repDetKpi').innerHTML = `
      <div class="card"><div class="card-title">Partidas</div><div class="card-value">${lines.length}</div></div>
      <div class="card"><div class="card-title">Importe</div><div class="card-value">${money(total)}</div></div>`;
    const body=lines.map(r=>`<tr><td>${r.folio}</td><td>${r.fecha.slice(0,16).replace('T',' ')}</td><td>${esc(r.cliente)}</td><td>${esc(r.sku)}</td><td>${esc(r.producto)}</td><td>${r.qty}</td><td>${money(r.precio)}</td><td>${money(r.importe)}</td></tr>`).join('');
    document.getElementById('repDetTabla').innerHTML=`<table><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>SKU</th><th>Producto</th><th>Cant.</th><th>P. Unit</th><th>Importe</th></tr></thead><tbody>${body||'<tr><td colspan="8">Sin registros</td></tr>'}</tbody></table>`;
  },
  exportDetallado(){
    const ini=document.getElementById('repDetIni').value||'0000-01-01';
    const fin=document.getElementById('repDetFin').value||'9999-12-31';
    const q=(document.getElementById('repDetQ').value||'').toLowerCase();
    const rows=[['Folio','Fecha','Cliente','SKU','Producto','Cantidad','Precio','Importe']];
    state.sales.forEach(s=>{
      const f=s.fecha.slice(0,10);
      if(f<ini || f>fin) return;
      const cliente=(state.customers.find(c=>c.id===s.cliente)?.nombre||'');
      s.items.forEach(i=>{
        const hay=(i.nombre.toLowerCase().includes(q) || cliente.toLowerCase().includes(q) || s.folio.toLowerCase().includes(q) || (i.sku||'').toLowerCase().includes(q));
        if(!hay) return;
        rows.push([s.folio,s.fecha,cliente,i.sku||'',i.nombre,i.qty,i.precio,i.qty*i.precio]);
      });
    });
    downloadCSV('reporte_detallado.csv',rows);
  },
  renderTops(){
    const sales=state.sales;
    Charts.barH(document.getElementById('topProductos'), Charts.topProducts(sales,10));
    // top clientes por total
    const by={};
    sales.forEach(s=>{const c=s.cliente||''; by[c]=(by[c]||0)+s.total;});
    const arr=Object.entries(by).map(([cid,total])=>({k:(state.customers.find(c=>c.id===cid)?.nombre||cid), v:total})).sort((a,b)=>b.v-a.v).slice(0,5);
    Charts.barH(document.getElementById('topClientes'), arr);
  }
};


const Membresias={
  limpiarTipo(){document.getElementById('tmNombre').value='';document.getElementById('tmDias').value='';document.getElementById('tmPrecio').value='';},
  guardarTipo(){
    const nombre=(document.getElementById('tmNombre').value||'').trim(); if(!nombre){alert('Nombre obligatorio');return;}
    const dias=parseInt(document.getElementById('tmDias').value||'0',10);
    const precio=parseFloat(document.getElementById('tmPrecio').value||'0');
    const arr=state.settings.tiposMembresia||[];
    const ex=arr.find(t=>t.nombre.toLowerCase()===nombre.toLowerCase());
    if(ex){ex.dias=dias; ex.precio=isNaN(precio)?0:precio;} else arr.unshift({nombre,dias,precio:isNaN(precio)?0:precio});
    state.settings.tiposMembresia=arr; DB.save(state); Ventas.fillTiposMembresia(); this.renderTipos(); alert('Tipo guardado.');
  },
  renderTipos(){
    const rows=(state.settings.tiposMembresia||[]).map(t=>`<tr><td>${esc(t.nombre)}</td><td>${t.dias}</td><td>${money(t.precio)}</td><td><button class='btn small' onclick="Membresias.editarTipo('${t.nombre.replace(/'/g,"\\'")}')">✏️</button> <button class='btn small danger' onclick="Membresias.eliminarTipo('${t.nombre.replace(/'/g,"\\'")}')">🗑️</button></td></tr>`).join('');
    document.getElementById('tmTabla').innerHTML=`<table><thead><tr><th>Nombre</th><th>Días</th><th>Precio</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="4">Sin tipos</td></tr>'}</tbody></table>`;
  },
  editarTipo(nombre){
    const t=(state.settings.tiposMembresia||[]).find(x=>x.nombre===nombre); if(!t)return;
    document.getElementById('tmNombre').value=t.nombre; document.getElementById('tmDias').value=t.dias; document.getElementById('tmPrecio').value=t.precio;
  },
  eliminarTipo(nombre){
    if(!confirm('¿Eliminar tipo de membresía?'))return;
    state.settings.tiposMembresia=(state.settings.tiposMembresia||[]).filter(t=>t.nombre!==nombre);
    DB.save(state); this.renderTipos(); Ventas.fillTiposMembresia();
  },
  renderTabla(){
    const ini=document.getElementById('memIni').value||'0000-01-01';
    const fin=document.getElementById('memFin').value||'9999-12-31';
    const q=(document.getElementById('memQ').value||'').toLowerCase();
    const rows=(state.memberships||[]).filter(m=>{
      const cliente=(state.customers.find(c=>c.id===m.cliente)?.nombre||'').toLowerCase();
      const tipo=(m.tipo||'').toLowerCase();
      const iniM=(m.inicio||'').slice(0,10);
      return iniM>=ini && iniM<=fin && (cliente.includes(q)||tipo.includes(q));
    }).map(m=>{
      const cliente=(state.customers.find(c=>c.id===m.cliente)?.nombre||'');
      const status=(new Date(m.fin)>=new Date()?'<span class="badge ok">Activa</span>':'<span class="badge bad">Vencida</span>');
      return `<tr><td>${esc(cliente)}</td><td>${esc(m.tipo||'')}</td><td>${esc(m.inicio||'')}</td><td>${esc(m.fin||'')}</td><td>${status}</td></tr>`;
    }).join('');
    document.getElementById('memTabla').innerHTML=`<table><thead><tr><th>Cliente</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Sin registros</td></tr>'}</tbody></table>`;
  },
  exportCSV(){
    const rows=[['Cliente','Tipo','Inicio','Fin','Estado']].concat((state.memberships||[]).map(m=>[
      (state.customers.find(c=>c.id===m.cliente)?.nombre||''),m.tipo||'',m.inicio||'',m.fin||'', (new Date(m.fin)>=new Date()?'Activa':'Vencida')
    ]));
    downloadCSV('membresias.csv',rows);
  }
};


const Config={
  guardar(){
    const iva=parseFloat(document.getElementById('cfgIVA').value||'0');
    const msj=document.getElementById('cfgMensaje').value||'Gracias por tu compra en Dinamita Gym 💥';
    state.settings.iva=isNaN(iva)?0:iva;
    state.settings.mensaje=msj;
    state.settings.negocio.nombre=document.getElementById('cfgBizName').value||'DINAMITA GYM';
    state.settings.negocio.direccion=document.getElementById('cfgBizAddr').value||'';
    state.settings.negocio.telefono=document.getElementById('cfgBizTel').value||'';
    state.settings.negocio.email=document.getElementById('cfgBizEmail').value||'';
    state.settings.negocio.redes=document.getElementById('cfgBizSocial').value||'';
    DB.save(state); Tickets.updateHeader(); alert('Configuración guardada.');
  },
  reset(){
    state.settings=JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    DB.save(state); this.render(); Tickets.updateHeader(); alert('Restablecido.');
  },
  loadLogo(input){
    const f=input.files[0]; if(!f)return;
    const r=new FileReader(); r.onload=e=>{ state.settings.logo=e.target.result; DB.save(state); this.render(); Tickets.updateHeader(); };
    r.readAsDataURL(f);
  },
  guardarTema(){
    const t=state.settings.theme;
    t.bg=document.getElementById('cfgBg').value;
    t.panel=document.getElementById('cfgPanel').value;
    t.menu=document.getElementById('cfgMenu').value;
    t.primary=document.getElementById('cfgPrimary').value;
    t.text=document.getElementById('cfgText').value;
    t.sub=document.getElementById('cfgSub').value;
    DB.save(state); setCssVars(); alert('Tema guardado.');
  },
  resetTema(){
    state.settings.theme = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.theme));
    DB.save(state); setCssVars(); this.render(); alert('Tema Dinamita restablecido.');
  },
  render(){
    document.getElementById('brandLogo').src=state.settings.logo||DEFAULT_LOGO;
    document.getElementById('ticketLogo').src=state.settings.logo||DEFAULT_LOGO;
    document.getElementById('cfgIVA').value=state.settings.iva||0;
    document.getElementById('cfgMensaje').value=state.settings.mensaje||'';
    document.getElementById('cfgBg').value=state.settings.theme.bg;
    document.getElementById('cfgPanel').value=state.settings.theme.panel;
    document.getElementById('cfgMenu').value=state.settings.theme.menu;
    document.getElementById('cfgPrimary').value=state.settings.theme.primary;
    document.getElementById('cfgText').value=state.settings.theme.text;
    document.getElementById('cfgSub').value=state.settings.theme.sub;
    document.getElementById('cfgBizName').value=state.settings.negocio.nombre||'';
    document.getElementById('cfgBizAddr').value=state.settings.negocio.direccion||'';
    document.getElementById('cfgBizTel').value=state.settings.negocio.telefono||'';
    document.getElementById('cfgBizEmail').value=state.settings.negocio.email||'';
    document.getElementById('cfgBizSocial').value=state.settings.negocio.redes||'';
  }
};

const Tickets={
  updateHeader(){
    document.getElementById('tBizName').textContent = state.settings.negocio.nombre || 'DINAMITA GYM';
    const info = [state.settings.negocio.direccion, state.settings.negocio.telefono, state.settings.negocio.email, state.settings.negocio.redes].filter(Boolean).join(' · ');
    document.getElementById('tBizInfo').textContent = info;
  },
  render(v){
    this.updateHeader();
    const lines=[];
    lines.push(center('🧾 '+(state.settings.negocio.nombre||'DINAMITA GYM')));
    lines.push('Folio: '+v.folio);
    lines.push('Fecha: '+v.fecha.replace('T',' ').slice(0,16));
    const cname=(state.customers.find(c=>c.id===v.cliente)?.nombre)||'';
    lines.push('Cliente: '+cname);
    lines.push(repeat('-',32));
    for(const i of v.items){
      const name=truncate(i.nombre,18);
      const right=`x${i.qty} ${money(i.precio)}`;
      lines.push(padRight(name,22)+padLeft(right,10));
      if(i._isService && i.mem){
        lines.push('  Vigencia: '+(i.mem.inicio||'')+' a '+(i.mem.fin||''));
      }
    }
    lines.push(repeat('-',32));
    lines.push(padRight('SUBTOTAL',20)+padLeft(money(v.subtotal),12));
    lines.push(padRight('IVA',20)+padLeft(money(v.iva),12));
    lines.push(padRight('TOTAL',20)+padLeft(money(v.total),12));
    lines.push(repeat('-',32));
    const nota=(v.notas&&v.notas.trim())?v.notas.trim():(state.settings.mensaje||'');
    if(nota)lines.push(nota);
    document.getElementById('ticketBody').textContent=lines.join('\n');
  },
  renderByFolio(f){const v=state.sales.find(s=>s.folio===f); if(!v){alert('Venta no encontrada');return;} this.render(v); UI.show('ticket');},
  print(){window.print();}
};

function downloadCSV(filename,rows){
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}

document.addEventListener('click',e=>{
  // close autocompletes (ventas)
  ['ventaClienteResults'].forEach(id=>{
    const box=document.getElementById(id);
    const wrap=box?.parentElement;
    if(box && wrap && !wrap.contains(e.target)) box.classList.add('hidden');
  });
});

window.addEventListener('DOMContentLoaded',UI.init);
