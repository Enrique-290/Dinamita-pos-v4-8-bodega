
// Simple store
const STORAGE_KEY='dinamita_pos_v4';
const SCHEMA_VERSION=8;

const DEFAULT_SETTINGS = {
  iva: 0, // default 0
  mensaje: 'Gracias por tu compra en Dinamita Gym 💥',
  logo: DEFAULT_LOGO,
  theme: {
    bg: '#ffffff', panel:'#fafafa', menu:'#f6f6f6',
    primary:'#d00', text:'#111111', sub:'#666666', border:'#e5e5e5'
  },
  negocio: {
    nombre:'DINAMITA GYM',
    direccion:'',
    telefono:'',
    email:'',
    redes:''
  },
  tiposMembresia: [
    {nombre:'Visita', dias:0, precio:50},
    {nombre:'Semana', dias:7, precio:200},
    {nombre:'Mensualidad', dias:30, precio:350},
    {nombre:'Quincenal', dias:15, precio:200},
    {nombre:'2 Meses', dias:60, precio:600},
    {nombre:'3 Meses', dias:90, precio:850},
    {nombre:'6 Meses', dias:182, precio:1500},
    {nombre:'12 Meses', dias:365, precio:2700},
    {nombre:'VIP', dias:365*5, precio:5000},
    {nombre:'Promo 2x$500', dias:30, precio:500},
    {nombre:'Estudiante', dias:30, precio:300},
    {nombre:'Tercera Edad', dias:30, precio:280}
  ]
};

const DB={
  load(){
    let raw=localStorage.getItem(STORAGE_KEY);
    if(raw){
      try{
        let d=JSON.parse(raw);
        if(!d.schemaVersion||d.schemaVersion<SCHEMA_VERSION)d=this.migrate(d);
        /* normalize V4.1 */
        try{ (d.sales||[]).forEach(s=>{ s.estado=s.estado||'completada'; s.pago=s.pago||{tipo:'efectivo'}; }); (d.products||[]).forEach(p=>{ if(!p.movs) p.movs=[]; }); }catch(e){}
        return d;
      }catch(e){}
    }
    let d=this.seed(); this.save(d); /* normalize V4.1 */
        try{ (d.sales||[]).forEach(s=>{ s.estado=s.estado||'completada'; s.pago=s.pago||{tipo:'efectivo'}; }); (d.products||[]).forEach(p=>{ if(!p.movs) p.movs=[]; }); }catch(e){}
        return d;
  },
  save(d){ localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); },
  seed(){
    const today=todayLocalDate();
    return {
      schemaVersion:SCHEMA_VERSION,
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      products:[
        {sku:'WHEY-CH-900',nombre:'Proteína Whey Chocolate 900g',categoria:'Suplementos',precio:499,costo:300,stock:12,img:'',descr:''},
        {sku:'SHAKER-700',nombre:'Shaker Dinamita 700ml',categoria:'Accesorios',precio:149,costo:80,stock:25,img:'',descr:''},
        {sku:'CAFE-LATTE',nombre:'Latte 355ml',categoria:'Cafetería',precio:45,costo:20,stock:50,img:'',descr:''}
      ],
      customers:[{id:'C1',nombre:'Público General',tel:'',email:'',certificadoMedico:false,entrenaSolo:false}],
      memberships:[],
      sales:[]
    };
  },
  migrate(d){
    d=d||{};
    d.schemaVersion=SCHEMA_VERSION;
    d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings||{});
    d.products=(d.products||[]).map(p=>({stock:0,costo:0,descr:'',img:'',categoria:'General',...p}));
    d.customers=(d.customers||[]).map(c=>({certificadoMedico:false,entrenaSolo:false,...c}));
    d.memberships=d.memberships||[];
    d.sales=(d.sales||[]).map(s=>({...s,subtotalCosto:s.subtotalCosto??(s.items||[]).reduce((a,i)=>a+(i.costo||0)*(i.qty||0),0)}));
    /* normalize V4.1 */
        try{ (d.sales||[]).forEach(s=>{ s.estado=s.estado||'completada'; s.pago=s.pago||{tipo:'efectivo'}; }); (d.products||[]).forEach(p=>{ if(!p.movs) p.movs=[]; }); }catch(e){}
        return d;
  }
};

let state=DB.load();

function esc(x){return (x||'').replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));}
function money(n){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0)}
function padRight(t,n){return (t+' '.repeat(n)).slice(0,n);}
function padLeft(t,n){return (' '.repeat(n)+t).slice(-n);}
function repeat(ch,n){return new Array(n+1).join(ch);}
function truncate(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+'…':s;}
function center(t){const w=32;const p=Math.max(0,Math.floor((w-t.length)/2));return ' '.repeat(p)+t;}

// === Local time helpers v4.6 ===
function todayLocalDate(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}
function nowLocalISO(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().replace('Z','');
}


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
      document.getElementById('viewTitle').textContent=b.textContent;
    });
    document.getElementById('backupBtn').onclick=Backup.export;
    document.getElementById('restoreBtn').onclick=()=>document.getElementById('restoreInput').click();
    document.getElementById('restoreInput').addEventListener('change',Backup.importFile);

    Ventas.init();
    Membresias.init();
    Dashboard.init();
    Inventario.renderTabla();
    Clientes.renderTabla();
    Membresias.renderTabla();
    Cafeteria.render();
    Historial.renderTabla();
    Config.render();
    Reportes.init();
    Tickets.updateHeader();
    UI.show('dashboard');
  },
  show(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
    document.getElementById('view-'+id).classList.remove('hidden');
    if(id==='dashboard'){Dashboard.render();}
    if(id==='reportes'){Reportes.renderAll();}
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

const Dashboard={
  init(){
    const t=todayLocalDate();
    const ini=document.getElementById('dashIni'); const fin=document.getElementById('dashFin');
    ini.value=t; fin.value=t;
    ini.onchange=Dashboard.render; fin.onchange=Dashboard.render;
    document.getElementById('dashExportCsv').onclick=Dashboard.exportCsv;
    document.getElementById('dashExportPng').onclick=Dashboard.exportPng;
  },
  _filterSales(){
    const ini=document.getElementById('dashIni').value||'0000-01-01';
    const fin=document.getElementById('dashFin').value||'9999-12-31';
    return state.sales.filter(s=>{ if(s.estado==='cancelada') return false; if(s.estado==='cancelada') return false;
      const f=s.fecha.slice(0,10);
      return f>=ini && f<=fin;
    });
  },
  render(){
    const today=todayLocalDate();
    const ventasHoy=state.sales.filter(s=>s.fecha.slice(0,10)===today && s.estado!=='cancelada');
    const totalHoy=ventasHoy.reduce((a,s)=>a+s.total,0);
    const utilidad=ventasHoy.reduce((a,s)=>a+((s.total-s.iva)-(s.subtotalCosto||0)),0);
    document.getElementById('kpiVentasHoy').textContent=money(totalHoy);
    document.getElementById('kpiTickets').textContent=String(ventasHoy.length);
    document.getElementById('kpiStock').textContent=String(state.products.reduce((a,p)=>a+(p.stock||0),0));
    document.getElementById('kpiGananciaHoy').textContent=money(utilidad);

    // Charts (very light canvas renderers)
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
  setup(canvas){canvas.width=canvas.clientWidth; canvas.height=280; const ctx=canvas.getContext('2d'); this.clear(ctx); return ctx;},
  line(canvas, data){
    if(!canvas)return; const ctx=this.setup(canvas);
    const padding=30;
    const w=ctx.canvas.width, h=ctx.canvas.height;
    const xs=data.map(d=>d.x), ys=data.map(d=>d.y);
    const maxY=Math.max(1,...ys);
    // axes
    ctx.strokeStyle='#bbb'; ctx.beginPath();
    ctx.moveTo(padding, h-padding); ctx.lineTo(w-padding, h-padding);
    ctx.moveTo(padding, h-padding); ctx.lineTo(padding, padding); ctx.stroke();
    // line
    ctx.strokeStyle='#d00'; ctx.beginPath();
    xs.forEach((x,i)=>{
      const px=padding + (i*(w-2*padding)/Math.max(1,xs.length-1));
      const py=h-padding - (ys[i]/maxY)*(h-2*padding);
      if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py);
    });
    ctx.stroke();
  },
  barH(canvas, data){
    if(!canvas)return; const ctx=this.setup(canvas);
    const padding=10; const w=ctx.canvas.width, h=ctx.canvas.height;
    const maxY=Math.max(1,...data.map(d=>d.v));
    const barH= Math.min(28, (h-2*padding)/Math.max(1,data.length));
    data.forEach((d,i)=>{
      const y=padding + i*barH + 4;
      const bw=((w-160)*d.v/maxY);
      ctx.fillStyle='#d00'; ctx.fillRect(150, y, bw, barH-8);
      ctx.fillStyle='#333'; ctx.fillText(truncate(d.k,18), 10, y+barH/2);
      ctx.fillText(String(d.v), 150+bw+6, y+barH/2);
    });
  },
  pie(canvas, data){
    if(!canvas)return; const ctx=this.setup(canvas);
    const w=ctx.canvas.width, h=ctx.canvas.height; const r=Math.min(w,h)/2 - 20;
    const cx=w/2, cy=h/2;
    const sum=data.reduce((a,d)=>a+d.v,0)||1; let ang0=-Math.PI/2;
    data.forEach((d,i)=>{
      const ang=2*Math.PI*(d.v/sum);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.fillStyle=['#d00','#555','#999','#0a0','#06c','#f80','#8a2be2'][i%7];
      ctx.arc(cx,cy,r,ang0,ang0+ang); ctx.fill(); ang0+=ang;
    });
  },
  // helpers to build datasets
  salesByDay(sales){
    const by={};
    sales.forEach(s=>{const d=s.fecha.slice(0,10); by[d]=(by[d]||0)+s.total;});
    const keys=Object.keys(by).sort();
    return keys.map(k=>({x:k,y:by[k]}));
  },
  topProducts(sales,n){
    const by={};
    sales.forEach(s=>s.items.forEach(i=>{ if(!i.nombre.startsWith('Membresía')) by[i.nombre]=(by[i.nombre]||0)+i.qty; }));
    const arr=Object.entries(by).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v).slice(0,n);
    return arr;
  },
  topMembresias(sales,n){
    const by={};
    sales.forEach(s=>s.items.forEach(i=>{ if(i.nombre.startsWith('Membresía')) by[i.nombre]=(by[i.nombre]||0)+i.qty; }));
    const arr=Object.entries(by).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v).slice(0,n);
    return arr;
  },
  topClientes(sales,n){
    const by={};
    sales.forEach(s=>{const c=s.cliente||''; by[c]=(by[c]||0)+s.total;});
    const arr=Object.entries(by).map(([cid,total])=>({k:(state.customers.find(c=>c.id===cid)?.nombre||cid), v:total})).sort((a,b)=>b.v-a.v).slice(0,n);
    return arr;
  }
};

const Ventas={
  carrito:[],
  tipo:'producto',
  init(){
    this.fillTiposMembresia();
    const tsel=document.getElementById('ventaTipo'); if(tsel){ tsel.value='producto'; }
    this.changeTipo();
    this.searchCliente(''); // no default cliente
  },
  changeTipo(){
    this.tipo=document.getElementById('ventaTipo').value;
    document.getElementById('ventaProductoBox').classList.toggle('hidden', this.tipo!=='producto');
    document.getElementById('ventaMembresiaBox').classList.add('hidden'); // v4.5: membresías solo en módulo Membresías
    this.renderCarrito();
    const t=todayLocalDate();
    document.getElementById('vMemInicio').value=t;
    // set default fin according to selected type
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
  const box=document.getElementById('ventaResultados'); if(!box) return;
  const q=(term||'').trim().toLowerCase();
  if(!q){ box.innerHTML=''; return; }
  const res=state.products.filter(p=>(p.nombre||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q));
  if(res.length===0){ box.innerHTML='<div class="muted">Sin resultados</div>'; return; }
  box.innerHTML='';
  res.forEach(p=>{
    const div=document.createElement('div'); div.className='list-item result-item'; div.style.cursor='pointer';
    div.innerHTML = `${p.img?`<img src="${p.img}" class="thumb" alt="">`:''}
      <div style="flex:1">
        <div><strong>${esc(p.nombre)}</strong></div>
        <div class="muted">(${esc(p.sku||'')})</div>
        <div class="muted">Precio: ${money(p.precio)} • Stock: ${p.stock}</div>
      </div>`;
    div.onclick = ()=> Ventas.addCarrito(p.sku,1);
    box.appendChild(div);
  });
},
  addCarrito(sku,qty=1){
    const p=state.products.find(x=>x.sku===sku); if(!p)return;
    const e=Ventas.carrito.find(x=>x.sku===sku && !x._isService);
    if(e) e.qty+=qty; else Ventas.carrito.push({sku,nombre:p.nombre,precio:p.precio,qty,img:p.img||''});
    Ventas.renderCarrito();
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
  fillTiposMembresia(){
    const sel=document.getElementById('vMemTipo'); sel.innerHTML='';
    (state.settings.tiposMembresia||[]).forEach(t=>{
      const o=document.createElement('option'); o.value=t.nombre; o.textContent=`${t.nombre} (${money(t.precio)})`; sel.appendChild(o);
    });
    this.updateMemFin();
  },
  updateMemFin(){
    const sel=document.getElementById('vMemTipo'); if(!sel) return;
    const tipo=sel.value;
    const tinfo=(state.settings.tiposMembresia||[]).find(t=>t.nombre===tipo) || {dias:0};
    const ini=document.getElementById('vMemInicio').value || todayLocalDate();
    const d=new Date(ini); d.setDate(d.getDate() + (tinfo.dias||0));
    document.getElementById('vMemFin').value = d.toISOString().slice(0,10);
  },
  renderCarrito(){
    const c=document.getElementById('carrito'); if(!c) return;
    c.innerHTML='';
    Ventas.carrito.forEach((i,idx)=>{
      const div=document.createElement('div'); div.className='list-item cart-item';
      div.innerHTML = `${i.img?`<img src="${i.img}" class="thumb" alt="">`:''}
        <div style="flex:1">
          <div><strong>${esc(i.nombre)}</strong></div>
          <div class="muted">(${esc(i.sku||'')})</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px">
          <button class="btn" onclick="Ventas.subOne(${idx})">–</button>
          <span>${i.qty}</span>
          <button class="btn" onclick="Ventas.addOne(${idx})">+</button>
          <div>${money(i.precio*i.qty)}</div>
          <button class="btn small" onclick="Ventas.delItem(${idx})">🗑️</button>
        </div>`;
      c.appendChild(div);
    });
    Ventas.updateTotals();
  },
  delItem(idx){Ventas.carrito.splice(idx,1); Ventas.renderCarrito();},
  addOne(idx){Ventas.carrito[idx].qty++; Ventas.renderCarrito();},
  subOne(idx){Ventas.carrito[idx].qty--; if(Ventas.carrito[idx].qty<=0){Ventas.delItem(idx);} else {Ventas.renderCarrito();}},
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
    // stock check solo para productos
    for(const it of Ventas.carrito){
      if(!it._isService){
        const p=state.products.find(x=>x.sku===it.sku);
        if(!p||p.stock<it.qty){alert('Stock insuficiente de '+it.nombre);return;}
      }
    }
    // descuenta stock solo productos
    Ventas.carrito.forEach(it=>{ if(!it._isService){ const p=state.products.find(x=>x.sku===it.sku); p.stock-=it.qty; }});
    const cliente=document.getElementById('ventaCliente').value || '';
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
    const venta={folio,fecha:nowLocalISO(),items,subtotal:totals.subtotal,iva:totals.iva,total:totals.total,cliente,notas:state.settings.mensaje||'',pago:{tipo:(document.getElementById('ventaPago')?.value||'efectivo')},estado:'completada'};
    venta.subtotalCosto=items.reduce((a,i)=>a+(i.costo||0)*i.qty,0);
    venta.ganancia=(venta.total-venta.iva)-venta.subtotalCosto;
    state.sales.unshift(venta); DB.save(state);

    // si hay membresías en el carrito, registrarlas
    items.filter(i=>i._isService && i.mem).forEach(i=>{
      const id='M'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      state.memberships.unshift({id,cliente,tipo:i.mem.tipo,inicio:i.mem.inicio,fin:i.mem.fin,notas:'(Desde Ventas)'});
    });
    DB.save(state);

    Ventas.carrito=[];
    Ventas.renderCarrito();
    // limpiar formulario de Ventas
    const vc=document.getElementById('ventaCliente'); if(vc) vc.value='';
    const vcs=document.getElementById('ventaClienteSearch'); if(vcs) vcs.value='';
    const vp=document.getElementById('ventaPago'); if(vp) vp.value='efectivo';
    const vs=document.getElementById('ventaResultados'); if(vs) vs.innerHTML='';
    Dashboard.render();
    Inventario.renderTabla();
    Historial.renderTabla();
    Tickets.render(venta);
    UI.show('ticket');
  }
};

const Inventario={
  imgData:'',
  limpiar(){['prodSku','prodNombre','prodCategoria','prodPrecio','prodCosto','prodStock','prodDescr'].forEach(id=>document.getElementById(id).value='');document.getElementById('prodImg').value='';this.imgData='';},
  loadImage(input){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{this.imgData=e.target.result;};r.readAsDataURL(f);},
  guardar(){
    const sku=document.getElementById('prodSku').value.trim();
    const nombre=document.getElementById('prodNombre').value.trim();
    if(!sku||!nombre){alert('SKU y Nombre obligatorios.');return;}
    const p={sku,nombre,categoria:document.getElementById('prodCategoria').value.trim()||'General',precio:parseFloat(document.getElementById('prodPrecio').value||'0'),costo:parseFloat(document.getElementById('prodCosto').value||'0'),stock:parseInt(document.getElementById('prodStock').value||'0',10),img:this.imgData||'',descr:document.getElementById('prodDescr').value.trim()};
    let ex=state.products.find(x=>x.sku===sku); if(ex)Object.assign(ex,p); else state.products.unshift(p);
    // v4.6: persist image
    if(ex){ if(Inventario.imgData){ ex.img=Inventario.imgData; } }
    else { if(Inventario.imgData){ p.img=Inventario.imgData; } }
    Inventario.imgData='';
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
      return `<tr><td>${esc(p.sku)}</td><td>${esc(p.nombre)}</td><td>${esc(p.categoria||'')}</td><td>${money(p.precio)}</td><td>${money(p.costo||0)}</td><td>${p.stock} ${badge}</td><td><button class="btn small" onclick="Inventario.edit('${p.sku}')">✏️</button> <button class="btn small danger" onclick="Inventario.del('${p.sku}')">🗑️</button>
        <button class="btn small" onclick="Inventario.entrada('${p.sku}')">➕ Entradas</button></td></tr>`;
    }).join('');
    document.getElementById('invTabla').innerHTML=`<table><thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="7">Sin productos</td></tr>'}</tbody></table>`;
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
    window.scrollTo({top:0,behavior:'smooth'});
  },
  del(sku){if(!confirm('¿Eliminar producto?'))return; state.products=state.products.filter(x=>x.sku!==sku); DB.save(state); this.renderTabla();},
  
entrada(sku){
  const p=state.products.find(x=>x.sku===sku); if(!p) return alert('Producto no encontrado');
  const val = prompt('Cantidad a ingresar para '+p.nombre+':','1');
  const qty = parseInt(val||'0',10);
  if(!qty || qty<=0) return;
  p.stock = (p.stock||0) + qty;
  p.movs = p.movs||[];
  p.movs.push({fecha:nowLocalISO(), tipo:'ENTRADA_MANUAL', cantidad:+qty, stockFinal:p.stock, nota:'Manual'});
  DB.save(state);
  this.renderTabla();
  alert('Stock actualizado: '+p.stock);
},
exportCSV(){const rows=[['SKU','Nombre','Categoría','Precio','Costo','Stock']].concat(state.products.map(p=>[p.sku,p.nombre,p.categoria||'',p.precio,p.costo||0,p.stock])); downloadCSV('inventario.csv',rows);}
};

const Clientes={
  limpiar(){['cliId','cliNombre','cliTel','cliEmail'].forEach(id=>document.getElementById(id).value='');document.getElementById('cliCertMed').checked=false;document.getElementById('cliEntrenaSolo').checked=false;},
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
    DB.save(state); this.renderTabla(); Ventas.searchCliente(''); Membresias.fillClientes(); this.limpiar(); alert('Cliente guardado.');
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
    DB.save(state); this.renderTabla(); Ventas.searchCliente(''); Membresias.fillClientes();
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

const Membresias={
  init(){ this.fillClientes(); this.fillTipos(); },

  manageTipos(){
    const m=document.getElementById('modalTipos');
    Membresias.renderTipos();
    m.classList.remove('hidden'); m.setAttribute('aria-hidden','false');
    const escFn=e=>{if(e.key==='Escape'){Membresias.closeTipos();document.removeEventListener('keydown',escFn);}};
    document.addEventListener('keydown',escFn);
  },
  closeTipos(){const m=document.getElementById('modalTipos'); m.classList.add('hidden'); m.setAttribute('aria-hidden','true');},
  renderTipos(){
    const cont=document.getElementById('tiposList');
    const t=state.settings.tiposMembresia||[];
    if(!cont) return;
    cont.innerHTML = t.map((x,i)=>`
      <div class="row" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:center">
        <div>${esc(x.nombre)}</div>
        <div>${x.dias||0} días</div>
        <div>${money(x.precio||0)}</div>
        <div><button class="btn small danger" onclick="Membresias.delTipo(${i})">🗑️</button></div>
      </div>`).join('') || '<em>Sin tipos aún</em>';
  },
  addTipo(){
    const nombre=(document.getElementById('tipoNombre').value||'').trim();
    const dias=parseInt(document.getElementById('tipoDias').value||'0',10);
    const precio=parseFloat(document.getElementById('tipoPrecio').value||'0');
    if(!nombre){alert('Nombre requerido');return;}
    (state.settings.tiposMembresia=state.settings.tiposMembresia||[]).push({nombre,dias:isNaN(dias)?0:dias,precio:isNaN(precio)?0:precio});
    DB.save(state); Membresias.renderTipos(); Membresias.fillTipos(); Ventas.fillTiposMembresia();
    document.getElementById('tipoNombre').value=''; document.getElementById('tipoDias').value=''; document.getElementById('tipoPrecio').value='';
  },
  delTipo(i){
    (state.settings.tiposMembresia||[]).splice(i,1);
    DB.save(state); Membresias.renderTipos(); Membresias.fillTipos(); Ventas.fillTiposMembresia();
  },
  cobrarAqui(){
    // Retrocompatibilidad: redirige a vender()
    return this.vender();
  },
  vender(){
    // Registra y cobra en un solo paso desde la sección Membresías (v4.5)
    const cliente=document.getElementById('memClienteId').value;
    if(!cliente){ alert('Selecciona un cliente válido'); return; }
    const tipo=document.getElementById('memTipo').value;
    const inicio=document.getElementById('memInicio').value;
    const fin=document.getElementById('memFin').value;
    const pagoSel=document.getElementById('memPago') ? document.getElementById('memPago').value : 'efectivo';
    const tinfo=(state.settings.tiposMembresia||[]).find(t=>t.nombre===tipo)||{precio:0};
    const folio='T'+Date.now().toString().slice(-8);
    const item={sku:'SERV-MEM', nombre:'Membresía '+tipo, precio:tinfo.precio, qty:1, _isService:true, mem:{tipo,inicio,fin}};
    const subtotal=item.precio, iva=subtotal*(state.settings.iva||0)/100, total=subtotal+iva;
    const venta={folio,fecha:nowLocalISO(),items:[item],subtotal,iva,total,cliente,notas:state.settings.mensaje||'', pago:{tipo:pagoSel}, estado:'completada'};
    venta.subtotalCosto=0; venta.ganancia=(venta.total-venta.iva);
    state.sales.unshift(venta);
    // Registrar membresía
    const id='M'+Date.now().toString(36);
    state.memberships.unshift({id,cliente,tipo,inicio,fin,notas:(document.getElementById('memNotas').value||'')});
    DB.save(state);
    // Refrescar vistas
    Historial.renderTabla(); Tickets.render(venta); UI.show('ticket');
    // Limpiar formulario para siguiente venta
    const busc=document.getElementById('memClienteSearch'); if(busc) busc.value='';
    const cid=document.getElementById('memClienteId'); if(cid) cid.value='';
    const pag=document.getElementById('memPago'); if(pag) pag.value='efectivo';
    const notas=document.getElementById('memNotas'); if(notas) notas.value='';
    const tipoSel=document.getElementById('memTipo'); if(tipoSel && tipoSel.options.length) tipoSel.selectedIndex=0;
    const hoy=todayLocalDate();
    const ini=document.getElementById('memInicio'); if(ini) ini.value=hoy;
    Membresias.changeTipo(); // recalcula fin
  },


  fillClientes(){
    document.getElementById('memClienteSearch').value='';
    document.getElementById('memClienteId').value='';
    document.getElementById('memClienteResults').innerHTML='';
    document.getElementById('memClienteResults').classList.add('hidden');
    const t=todayLocalDate();
    document.getElementById('memInicio').value=t;
    this.changeTipo();
  },
  fillTipos(){
    const sel=document.getElementById('memTipo'); sel.innerHTML='';
    (state.settings.tiposMembresia||[]).forEach(t=>{ const o=document.createElement('option'); o.textContent=t.nombre; sel.appendChild(o); });
  },
  searchCliente(term){
    const box=document.getElementById('memClienteResults');
    term=(term||'').trim().toLowerCase();
    if(!term){box.classList.add('hidden');box.innerHTML='';return;}
    const res=state.customers.filter(c=>((c.nombre||'')+' '+(c.tel||'')+' '+(c.email||'')).toLowerCase().includes(term)).slice(0,30);
    box.innerHTML=res.length?res.map(c=>`<div class="item" onclick="Membresias.pickCliente('${c.id}')"><div><strong>👤 ${esc(c.nombre||'')}</strong></div><div class="muted">📞 ${esc(c.tel||'')} · ✉️ ${esc(c.email||'')}</div></div>`).join(''):`<div class="item"><span class="muted">Sin coincidencias</span></div>`;
    box.classList.remove('hidden');
  },
  pickCliente(id){
    const c=state.customers.find(x=>x.id===id); if(!c)return;
    document.getElementById('memClienteId').value=c.id;
    document.getElementById('memClienteSearch').value=c.nombre||'';
    document.getElementById('memClienteResults').classList.add('hidden');
  },
  changeTipo(){
    const tipo=document.getElementById('memTipo').value;
    const tinfo=(state.settings.tiposMembresia||[]).find(t=>t.nombre===tipo) || {dias:0};
    const ini=document.getElementById('memInicio').value||todayLocalDate();
    const d=new Date(ini); d.setDate(d.getDate()+(tinfo.dias||0));
    document.getElementById('memFin').value=d.toISOString().slice(0,10);
  },
  guardar(){
    const cliente=document.getElementById('memClienteId').value;
    if(!cliente){alert('Selecciona un cliente del buscador.');return;}
    const tipo=document.getElementById('memTipo').value;
    const inicio=document.getElementById('memInicio').value;
    const fin=document.getElementById('memFin').value;
    if(fin<inicio){alert('La fecha de fin no puede ser menor al inicio.');return;}
    const notas=document.getElementById('memNotas').value||'';
    const id='M'+Date.now().toString(36);
    state.memberships.unshift({id,cliente,tipo,inicio,fin,notas});
    DB.save(state); this.renderTabla(); alert('Membresía registrada.');
  },
  status(m){
    const t=todayLocalDate();
    if(m.fin<t)return'vencida';
    const days=Math.ceil((new Date(m.fin)-new Date(t))/(1000*60*60*24));
    if(days<=5)return'próxima';
    return'activa';
  },
  renderTabla(){
    const q=(document.getElementById('memSearch').value||'').toLowerCase();
    const st=(document.getElementById('memStatus').value||'').toLowerCase();
    const rows=state.memberships.filter(m=>{
      const c=state.customers.find(x=>x.id===m.cliente);
      const name=c?c.nombre:'';
      const okQ=name.toLowerCase().includes(q);
      const status=this.status(m);
      const okS=!st||st===status;
      return okQ&&okS;
    }).map(m=>{
      const c=state.customers.find(x=>x.id===m.cliente);
      const name=c?c.nombre:m.cliente;
      const status=this.status(m);
      const badge=status==='activa'?'<span class="badge ok">✅ Activa</span>':status==='próxima'?'<span class="badge warn">⏳ Próx. a vencer</span>':'<span class="badge bad">❌ Vencida</span>';
      return `<tr><td>${esc(name)}</td><td>${esc(m.tipo)}</td><td>${esc(m.inicio)}</td><td>${esc(m.fin)}</td><td>${badge}</td><td>${esc(m.notas||'')}</td><td><button class="btn small" onclick="Membresias.toVentas('${m.id}')">💳 Cobrar en Ventas</button></td></tr>`;
    }).join('');
    document.getElementById('memTabla').innerHTML=`<table><thead><tr><th>Cliente</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Notas</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="7">Sin registros</td></tr>'}</tbody></table>`;
  },
  toVentas(id){
    const m=state.memberships.find(x=>x.id===id); if(!m)return;
    const tinfo=(state.settings.tiposMembresia||[]).find(t=>t.nombre===m.tipo) || {precio:0};
    // preparar carrito de Ventas con servicio
    UI.show('ventas');
    document.getElementById('ventaTipo').value='membresia'; Ventas.changeTipo();
    document.getElementById('ventaCliente').value=m.cliente;
    const c=state.customers.find(x=>x.id===m.cliente);
    document.getElementById('ventaClienteSearch').value=c?.nombre||'';
    Ventas.carrito=[{_isService:true,nombre:'Membresía '+m.tipo,precio:tinfo.precio,qty:1, mem:{tipo:m.tipo,inicio:m.inicio,fin:m.fin}}];
    Ventas.renderCarrito();
  },
  exportCSV(){
    const rows=[['ID','Cliente','Tipo','Inicio','Fin','Estado','Notas']].concat(state.memberships.map(m=>{
      const status=this.status(m);
      return [m.id,(state.customers.find(c=>c.id===m.cliente)?.nombre||''),m.tipo,m.inicio,m.fin,status,m.notas||''];
    }));
    downloadCSV('membresias.csv',rows);
  }
};

document.addEventListener('click',e=>{
  // close autocompletes
  ['ventaClienteResults','memClienteResults'].forEach(id=>{
    const box=document.getElementById(id);
    const wrap=box?.parentElement;
    if(box && wrap && !wrap.contains(e.target)) box.classList.add('hidden');
  });
});

const Cafeteria={
  render(){
    const cont=document.getElementById('cafGrid'); cont.innerHTML='';
    const arr=state.products.filter(p=>(p.categoria||'').toLowerCase().includes('cafeter'));
    if(arr.length===0){cont.innerHTML='<div>No hay productos de cafetería.</div>';return;}
    const placeholder='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"400\"><rect width=\"100%\" height=\"100%\" fill=\"%23f4f4f4\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%23999\" font-size=\"28\" font-family=\"Arial\">☕ Sin imagen</text></svg>';
    arr.forEach(p=>{
      const card=document.createElement('div'); card.className='card-prod';
      const img=p.img||placeholder;
      card.innerHTML=`<img src=\"${img}\" onerror=\"this.src='${placeholder}'\"><div class='pbody'><div class='pname'>☕ ${esc(p.nombre)}</div><div class='pprice'>${money(p.precio)}</div><div class='pbtns'><button class='btn small' onclick=\"Ventas.addCarrito('${p.sku}',1)\">➕ Agregar</button><button class='btn small outline' onclick=\"UI.show('ventas')\">➡️ Ir a cobrar</button></div></div>`;
      cont.appendChild(card);
    });
  }
};

const Historial={
  openFiltros(){
    const m=document.getElementById('modalFiltros'); m.classList.remove('hidden'); m.setAttribute('aria-hidden','false');
    const escFn=e=>{if(e.key==='Escape'){Historial.closeFiltros();document.removeEventListener('keydown',escFn);}};
    document.addEventListener('keydown',escFn);
    m.addEventListener('click',e=>{if(e.target.id==='modalFiltros')Historial.closeFiltros();},{once:true});
  },
  closeFiltros(){const m=document.getElementById('modalFiltros'); m.classList.add('hidden'); m.setAttribute('aria-hidden','true');},
  applyFiltros(){this.renderTabla(); this.closeFiltros();},
  clearFiltros(){['histFechaIni','histFechaFin','histFolio','histCliente','histProducto'].forEach(id=>document.getElementById(id).value='');document.getElementById('histPago').value='';this.renderTabla();},
  renderTabla(){
    const ini=document.getElementById('histFechaIni')?.value||'';
    const fin=document.getElementById('histFechaFin')?.value||'';
    const folio=(document.getElementById('histFolio')?.value||'').toLowerCase();
    const clienteQ=(document.getElementById('histCliente')?.value||'').toLowerCase();
    const prodQ=(document.getElementById('histProducto')?.value||'').toLowerCase();
    const pagoQ=(document.getElementById('histPago')?.value||'').toLowerCase();
    const rows=state.sales.filter(s=>{
      const f=s.fecha.slice(0,10);
      if(ini&&f<ini)return false;
      if(fin&&f>fin)return false;
      if(folio&&!s.folio.toLowerCase().includes(folio))return false;
      const cliente=(state.customers.find(c=>c.id===s.cliente)?.nombre||'').toLowerCase();
      if(clienteQ&&!cliente.includes(clienteQ))return false;
      if(prodQ&&!s.items.map(i=>i.nombre).join(' ').toLowerCase().includes(prodQ))return false;
      if(pagoQ && ((s.pago?.tipo||'efectivo').toLowerCase()!==pagoQ)) return false;
      return true;
    }).map(s=>{
      const cli=state.customers.find(c=>c.id===s.cliente)?.nombre||'';
      const itemsStr=s.items.map(i=>`${i.nombre} x${i.qty}`).join(', ');
      return `<tr><td>${esc(s.folio)}</td><td>${s.fecha.slice(0,16).replace('T',' ')}</td><td>${esc(cli)}</td><td>${esc(itemsStr)}</td>`+`<td>${money(s.total)}</td><td>${(s.pago?.tipo||'efectivo')}</td><td>${s.estado==='cancelada'?'Cancelada':'Completada'}</td><td>`+(s.estado==='cancelada' ? `<button class='btn small' onclick="Tickets.renderByFolio('${s.folio}')">🖨️ Reimprimir</button>` : `<button class='btn small' style="background:#d00;color:#fff" onclick="Historial.cancel('${s.folio}')">✖️ Cancelar</button> <button class='btn small' onclick="Tickets.renderByFolio('${s.folio}')">🖨️ Reimprimir</button>` )+`</td></tr>`;
    }).join('');
    document.getElementById('histTabla').innerHTML=`<table><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="8">Sin ventas</td></tr>'}</tbody></table>`;
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
    this.renderVentas(); this.renderMembresias(); this.renderInventario(); this.renderTops();
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
  exportVentasDetallado(){
    const ini=document.getElementById('repVenIni').value||'0000-01-01';
    const fin=document.getElementById('repVenFin').value||'9999-12-31';
    const ventas=state.sales.filter(s=>{const f=(s.fecha||'').slice(0,10); return f>=ini && f<=fin;});
    const rows=[['Folio','Producto','Pz','Precio']];
    ventas.forEach(s=>{
      (s.items||[]).forEach(i=>{
        rows.push([s.folio, i.nombre, i.qty, i.precio]);
      });
    });
    downloadCSV('reporte_ventas_detallado.csv', rows);
  },

  renderMembresias(){
    const ini=document.getElementById('repMemIni').value||'0000-01-01';
    const fin=document.getElementById('repMemFin').value||'9999-12-31';
    const rows=state.memberships.filter(m=>m.inicio>=ini && m.inicio<=fin);
    const activas=rows.filter(m=>Membresias.status(m)==='activa').length;
    const venc=rows.filter(m=>Membresias.status(m)==='vencida').length;
    const prox=rows.filter(m=>Membresias.status(m)==='próxima').length;
    document.getElementById('repMemKpi').innerHTML = `
      <div class="card"><div class="card-title">Registros</div><div class="card-value">${rows.length}</div></div>
      <div class="card"><div class="card-title">Activas</div><div class="card-value">${activas}</div></div>
      <div class="card"><div class="card-title">Próx. a vencer</div><div class="card-value">${prox}</div></div>
      <div class="card"><div class="card-title">Vencidas</div><div class="card-value">${venc}</div></div>`;
    const body=rows.map(m=>{
      const cli=state.customers.find(c=>c.id===m.cliente)?.nombre||'';
      const st=Membresias.status(m);
      return `<tr><td>${esc(cli)}</td><td>${esc(m.tipo)}</td><td>${m.inicio}</td><td>${m.fin}</td><td>${st}</td><td>${esc(m.notas||'')}</td></tr>`;
    }).join('');
    document.getElementById('repMemTabla').innerHTML=`<table><thead><tr><th>Cliente</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Notas</th></tr></thead><tbody>${body||'<tr><td colspan="6">Sin registros</td></tr>'}</tbody></table>`;
  },
  exportMembresias(){
    const ini=document.getElementById('repMemIni').value||'0000-01-01';
    const fin=document.getElementById('repMemFin').value||'9999-12-31';
    const rows=[['Cliente','Tipo','Inicio','Fin','Estado','Notas']]
      .concat(state.memberships.filter(m=>m.inicio>=ini && m.inicio<=fin).map(m=>[(state.customers.find(c=>c.id===m.cliente)?.nombre||''),m.tipo,m.inicio,m.fin,Membresias.status(m),m.notas||'']));
    downloadCSV('reporte_membresias.csv', rows);
  },
  renderInventario(){
    const rows=state.products.map(p=>`<tr><td>${esc(p.sku)}</td><td>${esc(p.nombre)}</td><td>${esc(p.categoria||'')}</td><td>${money(p.precio)}</td><td>${money(p.costo||0)}</td><td>${p.stock}</td></tr>`).join('');
    document.getElementById('repInvTabla').innerHTML=`<table><thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Sin productos</td></tr>'}</tbody></table>`;
  },
  renderTops(){
    const sales=state.sales;
    Charts.barH(document.getElementById('topProductos'), Charts.topProducts(sales,10));
    Charts.pie(document.getElementById('topMembresias'), Charts.topMembresias(sales,5));
    Charts.barH(document.getElementById('topClientes'), Charts.topClientes(sales,5));
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
    state.settings.iva=0;
    state.settings.mensaje='Gracias por tu compra en Dinamita Gym 💥';
    state.settings.logo=DEFAULT_LOGO;
    state.settings.negocio={...DEFAULT_SETTINGS.negocio};
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
    lines.push('Pago con: '+(((v.pago&&v.pago.tipo)||'efectivo').replace(/^./,c=>c.toUpperCase())));lines.push(repeat('-',32));
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

window.addEventListener('DOMContentLoaded',UI.init);


// === Dinamita POS v4.3 — helpers DOM-inject ===
(function(){
  try{
    (state.sales||[]).forEach(s=>{ s.estado=s.estado||'completada'; s.pago=s.pago||{tipo:'efectivo'}; });
    (state.products||[]).forEach(p=>{ if(!p.movs) p.movs=[]; });
  }catch(e){}

  function ensurePagoUI(){
    try{
      const ventasRoot = document.querySelector('[data-section="ventas"]') || document.getElementById('ventas') || document.querySelector('.ventas');
      if(!ventasRoot || ventasRoot.dataset.pagoReady) return;
      const target = ventasRoot.querySelector('.panel, .card, form, .box') || ventasRoot;
      const wrap = document.createElement('div');
      wrap.style.display='flex'; wrap.style.gap='12px'; wrap.style.alignItems='center'; wrap.style.margin='8px 0 4px 0';
      wrap.innerHTML = "<label style='font-weight:600'>Pago con</label> \
      <select id='ventaPago' class='input' style='max-width:220px;padding:6px;border-radius:8px'> \
        <option value='efectivo' selected>Efectivo</option> \
        <option value='tarjeta'>Tarjeta</option> \
        <option value='transferencia'>Transferencia</option> \
      </select>";
      const totals = ventasRoot.querySelector('.totales, .total, .sum, .right, [data-role=\"totales\"]');
      const confirmBtn = Array.from(ventasRoot.querySelectorAll('button')).find(b => (b.textContent||'').toLowerCase().includes('confirmar venta'));
      if(totals && totals.parentNode){ totals.parentNode.insertBefore(wrap, totals); }
      else if(confirmBtn && confirmBtn.parentNode){ confirmBtn.parentNode.insertBefore(wrap, confirmBtn); }
      else { target.insertBefore(wrap, target.firstChild); }
      const sel = wrap.querySelector('#ventaPago');
      sel.addEventListener('change', ()=>{ window.__pagoTipo = sel.value; });
      window.__pagoTipo = sel.value;
      ventasRoot.dataset.pagoReady='1';
    }catch(e){}
  }

  if(!(window.Inventario && typeof Inventario.entrada==='function')){
    window.Inventario = window.Inventario || {};
    Inventario.entrada = function(sku){
      try{
        const p=(state.products||[]).find(x=>x.sku===sku); if(!p) return alert('Producto no encontrado');
        const val=prompt('Cantidad a ingresar para '+p.nombre+':','1');
        const qty=parseInt(val||'0',10); if(!qty||qty<=0) return;
        p.stock=(p.stock||0)+qty;
        p.movs=p.movs||[]; p.movs.push({fecha:nowLocalISO(), tipo:'ENTRADA_MANUAL', cantidad:+qty, stockFinal:p.stock, nota:'Manual'});
        DB.save(state);
        if(Inventario.renderTabla) Inventario.renderTabla();
        alert('Stock actualizado: '+p.stock);
      }catch(e){ alert('Error entradas: '+(e&&e.message?e.message:e)); }
    };
  }
  function injectEntradasButtons(){
    try{
      const invTable = document.querySelector('#inventario table, [data-section=\"inventario\"] table');
      if(!invTable) return;
      invTable.querySelectorAll('tbody tr').forEach(tr=>{
        const tds=tr.querySelectorAll('td'); if(!tds.length) return;
        const sku=(tds[0].textContent||'').trim();
        const acciones=tds[tds.length-1]; if(!acciones || acciones.querySelector('button[data-role=\"entradas\"]')) return;
        const btn=document.createElement('button'); btn.className='btn small'; btn.style.marginLeft='6px';
        btn.textContent='➕ Entradas'; btn.setAttribute('data-role','entradas'); btn.onclick=()=>Inventario.entrada(sku);
        acciones.appendChild(btn);
      });
    }catch(e){}
  }

  if(!(window.Historial && typeof Historial.cancel==='function')){
    window.Historial = window.Historial || {};
    Historial.cancel = function(folio){
      try{
        const s=(state.sales||[]).find(x=>x.folio===folio);
        if(!s){ alert('Venta no encontrada'); return; }
        if(s.estado==='cancelada'){ alert('La venta ya está cancelada.'); return; }
        if(!confirm('¿Cancelar la venta '+folio+'?\\nLos productos se regresarán al inventario.')) return;
        (s.items||[]).forEach(i=>{
          if(!i._isService){
            const p=(state.products||[]).find(x=>x.sku===i.sku);
            if(p){
              p.stock=(p.stock||0)+(i.qty||0);
              p.movs=p.movs||[]; p.movs.push({fecha:nowLocalISO(), tipo:'CANCELACION', cantidad:+(i.qty||0), stockFinal:p.stock, ref:folio});
            }
          }
        });
        s.estado='cancelada'; s.cancelInfo={fecha:nowLocalISO(), usuario:'admin'};
        DB.save(state);
        if(Dashboard&&Dashboard.render) Dashboard.render();
        if(Inventario&&Inventario.renderTabla) Inventario.renderTabla();
        if(Historial&&Historial.renderTabla) Historial.renderTabla();
        alert('✅ Venta cancelada y stock restituido.');
      }catch(e){ alert('Error al cancelar: '+(e&&e.message?e.message:e)); }
    };
  }
  function injectCancelarButtons(){
    try{
      const table=document.getElementById('histTabla')||document.querySelector('#historial table, [data-section=\"historial\"] table');
      if(!table) return;
      try{
        const labels=Array.from(table.querySelectorAll('thead th')).map(x=>(x.textContent||'').toLowerCase().trim());
        const tr=table.querySelector('thead tr');
        if(tr){
          if(labels.indexOf('pago')===-1){ const th=document.createElement('th'); th.textContent='Pago'; tr.insertBefore(th, tr.lastElementChild); }
          if(labels.indexOf('estado')===-1){ const th=document.createElement('th'); th.textContent='Estado'; tr.insertBefore(th, tr.lastElementChild); }
        }
      }catch(e){}
      table.querySelectorAll('tbody tr').forEach(tr=>{
        const tds=tr.querySelectorAll('td'); if(tds.length<5) return;
        const folio=(tds[0].textContent||'').trim();
        const s=(state.sales||[]).find(x=>x.folio===folio); if(!s) return;
        const last=tds[tds.length-1];
        if(tds.length<=6){
          const pagoTd=document.createElement('td'); pagoTd.textContent=(s.pago&&s.pago.tipo)||'efectivo';
          const estTd=document.createElement('td'); estTd.textContent=s.estado==='cancelada'?'Cancelada':'Completada';
          tr.insertBefore(pagoTd, last); tr.insertBefore(estTd, last);
        }else{
          let pagoTd=tds[tds.length-3], estTd=tds[tds.length-2];
          if(pagoTd) pagoTd.textContent=(s.pago&&s.pago.tipo)||'efectivo';
          if(estTd) estTd.textContent=s.estado==='cancelada'?'Cancelada':'Completada';
        }
        if(s.estado!=='cancelada' && !last.querySelector('button[data-role=\"cancelar\"]')){
          const btn=document.createElement('button'); btn.className='btn small'; btn.style.background='#d00'; btn.style.color='#fff'; btn.style.marginRight='6px';
          btn.setAttribute('data-role','cancelar'); btn.textContent='✖️ Cancelar'; btn.onclick=()=>Historial.cancel(folio);
          last.insertBefore(btn, last.firstChild);
        }
      });
    }catch(e){}
  }

  function onRender(){ ensurePagoUI(); injectEntradasButtons(); injectCancelarButtons(); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', onRender); } else { onRender(); }

  try{ const _h=Historial&&Historial.renderTabla; if(typeof _h==='function'){ Historial.renderTabla=function(){ const r=_h.apply(Historial,arguments); injectCancelarButtons(); return r; }; } }catch(e){}
  try{ const _i=Inventario&&Inventario.renderTabla; if(typeof _i==='function'){ Inventario.renderTabla=function(){ const r=_i.apply(Inventario,arguments); injectEntradasButtons(); return r; }; } }catch(e){}
  try{ const _d=Dashboard&&Dashboard.render; if(typeof _d==='function'){ Dashboard.render=function(){ const r=_d.apply(Dashboard,arguments); ensurePagoUI(); return r; }; } }catch(e){}

  console.log('Dinamita POS v4.3 helpers cargados');
})();
// === end v4.3 helpers ===
