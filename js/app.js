import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "../config/firebase-config.js";

/* ==== DOM READY FAIL-SAFE ==== */
const onReady = (cb) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb, { once: true });
  } else {
    cb();
  }
};

onReady(() => {
  // Force-hide overlays on load in case CSS changed
  const loadingOverlay = document.getElementById('loadingOverlay');
  const confirmModal   = document.getElementById('confirmModal');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
  if (confirmModal)   confirmModal.style.display   = 'none';

  /* ==== INIT FIREBASE ==== */
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  /* ==== UTILITIES ==== */
  const fmtCRC = (n) => new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC',maximumFractionDigits:0}).format(n);
  const parseCRC = (s) => Number(String(s).replace(/[^0-9]/g,'')) || 0;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  const steps = [step1, step2, step3].filter(Boolean);

  const label1 = document.querySelector('.step-1');
  const label2 = document.querySelector('.step-2');
  const label3 = document.querySelector('.step-3');
  const labels = [label1, label2, label3].filter(Boolean);

  const hideSoft = (el) => { if(!el) return; el.style.display = 'none'; el.classList?.add('hidden'); };
  const showSoft = (el) => { if(!el) return; el.style.display = '';     el.classList?.remove('hidden'); };
  const setActiveLabel = (i) => labels.forEach((l,ix)=> l?.classList.toggle('is-active', ix===i));

  const showStep = (i) => {
    steps.forEach((s,ix)=> ix===i ? showSoft(s) : hideSoft(s));
    setActiveLabel(i);
    window.scrollTo({top:0, behavior:'smooth'});
  };

  /* ==== STATUS GROUPS + REQUIRED FIELDS ==== */
  const estatus = document.getElementById('estatus');
  const groups = {
    empleado:     document.getElementById('fs-empleado'),
    pensionado:   document.getElementById('fs-pensionado'),
    independiente:document.getElementById('fs-independiente'),
    empresario:   document.getElementById('fs-empresario'),
  };

  const clearRequired = () => document.querySelectorAll('[data-req]')?.forEach(el => {
    el.required = false; el.removeAttribute('aria-required');
  });
  const applyRequiredFor = (status) => {
    clearRequired();
    document.querySelectorAll(`[data-req="${status}"]`)?.forEach(el => {
      el.required = true; el.setAttribute('aria-required','true');
    });
  };
  const toggleStatus = () => {
    Object.values(groups).forEach(g=> hideSoft(g));
    const active = groups[estatus?.value] || groups.empleado;
    showSoft(active);
    applyRequiredFor(estatus?.value || 'empleado');
  };
  estatus?.addEventListener('change', toggleStatus);
  toggleStatus();

  /* ==== VALIDATION (visible controls only) ==== */
  function validateSection(sectionEl){
    if (!sectionEl) return true;
    const controls = sectionEl.querySelectorAll('input, select, textarea');
    for (const el of controls){
      const fieldset = el.closest('.fieldset');
      if (fieldset && (fieldset.style.display === 'none' || fieldset.classList.contains('hidden'))) continue;
      if (el.required && !el.checkValidity()){
        el.scrollIntoView({behavior:'smooth', block:'center'});
        el.reportValidity();
        return false;
      }
    }
    return true;
  }

  /* ==== PREVIEW (declare BEFORE any first update) ==== */
  const pvNombre   = document.getElementById('pvNombre');
  const pvTelefono = document.getElementById('pvTelefono');
  const pvEmail    = document.getElementById('pvEmail');
  const pvMonto    = document.getElementById('pvMonto');
  const pvCuota    = document.getElementById('pvCuota');

  function updatePreview(){
    if(pvNombre)   pvNombre.textContent   = (document.getElementById('nombre')?.value || '—');
    if(pvTelefono) pvTelefono.textContent = (document.getElementById('telefono')?.value || '—');
    if(pvEmail)    pvEmail.textContent    = (document.getElementById('email')?.value || '—');
    if(pvMonto)    pvMonto.textContent    = fmtCRC(Number(document.getElementById('montoRange')?.value || 0));
    if(pvCuota)    pvCuota.textContent    = document.getElementById('cuota')?.textContent || '—';
  }

  /* ==== SLIDERS / CUOTA ==== */
  const montoRange = document.getElementById('montoRange');
  const montoInput = document.getElementById('montoInput');
  const plazoRange = document.getElementById('plazoRange');
  const plazoInput = document.getElementById('plazoInput');
  const cuotaEl    = document.getElementById('cuota');

  function updateCuota(){
    if(!montoRange || !plazoRange || !cuotaEl) return;
    const P = Number(montoRange.value), n = Number(plazoRange.value), r = 0.08/12;
    const cuota = Math.round(P * (r / (1 - Math.pow(1 + r, -n))));
    cuotaEl.textContent = fmtCRC(cuota);
  }
  function updateFromRange(){
    if(montoRange && montoInput) montoInput.value = fmtCRC(Number(montoRange.value));
    if(plazoRange && plazoInput) plazoInput.value = Number(plazoRange.value);
    updateCuota(); updatePreview();
  }
  function updateFromInputs(){
    if(montoInput && montoRange){
      let amount = parseCRC(montoInput.value); amount = Math.min(Math.max(amount,300000),10000000);
      montoRange.value = amount; montoInput.value = fmtCRC(amount);
    }
    if(plazoInput && plazoRange){
      let months = Number(plazoInput.value||12); months = Math.min(Math.max(months,6),60);
      plazoRange.value = months; plazoInput.value = months;
    }
    updateCuota(); updatePreview();
  }
  ['input','change'].forEach(ev=>{
    montoRange?.addEventListener(ev, updateFromRange);
    plazoRange?.addEventListener(ev, updateFromRange);
    montoInput?.addEventListener(ev, updateFromInputs);
    plazoInput?.addEventListener(ev, updateFromInputs);
  });

  // First sync after preview elements are defined
  updateFromRange();

  /* ==== NAV BUTTONS (explicit type=button enforced) ==== */
  // Prevent ALL form submits (Enter key, default submit buttons)
  document.querySelectorAll('form').forEach(f=>{
    f.addEventListener('submit', (e)=> e.preventDefault());
  });
  // Enforce type="button" on nav buttons so they never submit
  ['next1','back2','next2','back3','submitBtn'].forEach(id=>{
    const el = document.getElementById(id);
    if (el && el.tagName === 'BUTTON') el.setAttribute('type','button');
  });

  document.getElementById('next1')?.addEventListener('click', (e)=>{ e.preventDefault(); if(!validateSection(step1)) return; showStep(1); });
  document.getElementById('back2')?.addEventListener('click', (e)=>{ e.preventDefault(); showStep(0); });
  document.getElementById('next2')?.addEventListener('click', (e)=>{ e.preventDefault(); if(!validateSection(step2)) return; updatePreview(); showStep(2); });
  document.getElementById('back3')?.addEventListener('click', (e)=>{ e.preventDefault(); showStep(1); });

  /* ==== FORM RESETTER (used after success) ==== */
  function resetAllFields(){
    document.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = false;
      } else if (typeof el.defaultValue !== 'undefined') {
        el.value = el.defaultValue;
      } else {
        el.value = '';
      }
    });

    const estatusEl = document.getElementById('estatus');
    if (estatusEl) estatusEl.value = 'empleado';
    if (typeof toggleStatus === 'function') toggleStatus();

    if (typeof updateFromInputs === 'function') updateFromInputs();
    if (typeof updateFromRange === 'function')  updateFromRange();

    // Clear preview explicitly
    if (pvNombre)   pvNombre.textContent = '—';
    if (pvTelefono) pvTelefono.textContent = '—';
    if (pvEmail)    pvEmail.textContent = '—';
    if (pvMonto)    pvMonto.textContent = '—';
    if (pvCuota)    pvCuota.textContent = '—';
  }

  /* ==== OVERLAYS (no CSS dependency) ==== */
  const showLoading = () => {
    if (!loadingOverlay) return;
    loadingOverlay.innerHTML = '<div class="loading-card"><div class="spinner"></div><div style="font-weight:800">Enviando tu solicitud…</div><div class="loading-sub">Por favor, no cierres esta ventana</div></div>';
    loadingOverlay.style.display = 'flex';
  };
  const hideLoading = () => { if (loadingOverlay) loadingOverlay.style.display = 'none'; };

  /* ==== ENHANCED MODAL (instructions + close-tab) ==== */
  const showModal = (loanId) => {
    if (!confirmModal) return;

    const waText  = `Hola, mi código de solicitud es ${loanId}. ¿Podemos continuar con el siguiente paso?`;
    const mailSub = `Mi código de solicitud ${loanId}`;
    const mailBody= `Hola,%0D%0A%0D%0AMi código de solicitud es ${loanId}.%0D%0AQuisiera continuar con el siguiente paso de mi préstamo.%0D%0A%0D%0AGracias.`;

    confirmModal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <h3 class="modal-title">¡Listo! Recibimos tu solicitud</h3>
        <p class="modal-text">
          Este es tu <strong>código de solicitud (Loan ID)</strong>.<br>
          <strong>Guardalo</strong>: lo vas a usar para consultar tu estado (aprobado o no).
        </p>

        <div class="kv">
          <div class="kv-code">${loanId}</div>
          <button id="copyLoanId" class="btn copy" type="button">Copiar</button>
        </div>

        <p class="modal-text">Enviá este código a tu agente para continuar:</p>

        <div class="modal-actions">
          <a class="btn wa" id="waLink"
             href="https://wa.me/573244674918?text=${encodeURIComponent(waText)}"
             target="_blank" rel="noopener">WhatsApp</a>

          <a class="btn messenger" id="msLink"
             href="https://m.me/?ref=${encodeURIComponent(loanId)}"
             target="_blank" rel="noopener">Messenger</a>

          <a class="btn ghost" id="emailLink"
             href="mailto:support@instant-prestamos.online?subject=${encodeURIComponent(mailSub)}&body=${mailBody}">
             Enviar por Email
          </a>

          <button id="closeModal" class="btn close" type="button">Cerrar</button>
        </div>

        <p class="modal-text" style="margin-top:10px">
          Por tu seguridad, <strong>no compartas</strong> tu código públicamente.
        </p>
      </div>
    `;

    confirmModal.style.display = 'flex';

    document.getElementById('copyLoanId')?.addEventListener('click', async ()=>{
      try {
        await navigator.clipboard.writeText(loanId);
        const b = document.getElementById('copyLoanId');
        if (b){ b.textContent='Copiado ✓'; setTimeout(()=>b.textContent='Copiar',1500); }
      } catch(e){}
    });

    document.getElementById('closeModal')?.addEventListener('click', ()=>{
      // Hide modal and try to close the tab
      confirmModal.style.display = 'none';
      try {
        window.open('', '_self');
        window.close();
      } catch (e) {}
      // Fallback message if blocked
      setTimeout(()=>{ alert('Podés cerrar esta pestaña ahora. ¡Gracias!'); }, 50);
    });
  };

  /* ==== LOAN ID as DOC ID ==== */
  function randomLoanId(len = 8){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return `IP-${out}`;
  }
  async function ensureUniqueLoanId(){
    for(let i=0;i<6;i++){
      const candidate = randomLoanId(8);
      const ref = doc(db, 'applications', candidate);
      const snap = await getDoc(ref);
      if (!snap.exists()) return candidate;
    }
    return randomLoanId(10);
  }

  /* ==== SUBMIT ==== */
  document.getElementById('submitBtn')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const consent = document.getElementById('consent');
    if (consent && !consent.checked){
      alert('Debés autorizar la verificación de datos.');
      return;
    }

    const payload = {
      nombre:  document.getElementById('nombre')?.value.trim() || "",
      cedula:  document.getElementById('cedula')?.value.trim() || "",
      dob:     document.getElementById('dob')?.value || "",
      telefono:document.getElementById('telefono')?.value.trim() || "",
      email:   document.getElementById('email')?.value.trim() || "",
      estadoCivil: document.getElementById('estadoCivil')?.value || "",
      direccion: {
        provincia: document.getElementById('provincia')?.value.trim() || "",
        canton:    document.getElementById('canton')?.value.trim() || "",
        distrito:  document.getElementById('distrito')?.value.trim() || "",
      },
      estatus: estatus?.value || "empleado",
      ingresosMensuales: Number(document.getElementById('ingresos')?.value || 0),
      banco: document.getElementById('banco')?.value || "",
      empleador: document.getElementById('empleador')?.value.trim() || "",
      antiguedadMeses: Number(document.getElementById('antiguedad')?.value || 0),
      tipoContrato: document.getElementById('tipoContrato')?.value || "",
      bancoSalario: document.getElementById('bancoSalario')?.value.trim() || "",
      ccssAsegurado: document.getElementById('ccss')?.value.trim() || "",
      entidadPension: document.getElementById('entidadPension')?.value || "",
      tipoPension: document.getElementById('tipoPension')?.value || "",
      bancoPension: document.getElementById('bancoPension')?.value.trim() || "",
      actividad: document.getElementById('actividad')?.value.trim() || "",
      regimen: document.getElementById('regimen')?.value || "",
      tiempoActividadMeses: Number(document.getElementById('tiempoActividad')?.value || 0),
      nite: document.getElementById('nitenum')?.value.trim() || "",
      ccssIndependiente: document.getElementById('ccssIndep')?.value.trim() || "",
      empresa: document.getElementById('empresa')?.value.trim() || "",
      cedulaJuridica: document.getElementById('cedulaJuridica')?.value.trim() || "",
      antiguedadEmpresaMeses: Number(document.getElementById('antiguedadEmpresa')?.value || 0),
      facturacionMensual: Number(document.getElementById('facturacion')?.value || 0),
      bancoEmpresa: document.getElementById('bancoEmpresa')?.value.trim() || "",
      monto: Number(montoRange?.value || 0),
      plazo: Number(plazoRange?.value || 0),
      cuotaEstimada: document.getElementById('cuota')?.textContent || "",
      createdAt: serverTimestamp()
    };

    showLoading();

    try{
      const loanId = await ensureUniqueLoanId();
      payload.loanId = loanId;

      const ref = doc(collection(db, 'applications'), loanId);
      await setDoc(ref, payload);

      // Simulate a short processing wait for UX
      await sleep(4500);
      hideLoading();

      // Show modal + clear the form
      showModal(loanId);
      resetAllFields();

      // Optional: return UI to step 1 if they stay
      showStep(0);

      try{ localStorage.setItem('instant_loan_id', loanId); }catch(e){}
    }catch(err){
      console.error('Submit error:', err);
      hideLoading();
      const code = err?.code || 'unknown';
      const msg  = err?.message || String(err);
      alert(`Error al enviar: ${code}\n${msg}\n\nTips:\n- Reglas de Firestore (allow create en /applications)\n- firebaseConfig.projectId correcto\n- Firestore habilitado`);
    }
  });

  // Start on step 1 explicitly
  showStep(0);
});
