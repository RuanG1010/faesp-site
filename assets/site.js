(() => {
  const CONFIG = {
    registration: "https://docs.google.com/forms/u/0/d/e/1FAIpQLSeT2rxU7fJEGInjbVW6CXd04wQixTWRvakBGSvZak0doia8fQ/viewform?pli=1",
    whatsapp: "https://wa.me/5511962248927",
    portal: "https://aluno.adm-faesp.org/login/",
    email: "faespguaianases@gmail.com",
    pix: "coordenacao.faesp07@gmail.com",
    officialSite: "https://www.faesp.org/",
    officialExtensions: "https://www.faesp.org/extensoes-leste",
    cnpj: "04.046.560/0001-38",
    legalName: "Faculdade Evangélica de São Paulo",
    institutionalAddress: "Rua Conselheiro Cotegipe, 273, Belenzinho, São Paulo/SP"
  };
  const TERMS_VERSION = "2026-10-24";
  window.FAESP_CONFIG = CONFIG;

  const base = document.documentElement.dataset.base || ".";
  const page = document.body.dataset.page || "home";
  const path = (p="") => `${base}/${p}`.replace(/\/$/, "/");

  if (!document.querySelector('link[data-compliance-css]')) {
    const complianceCss = document.createElement("link");
    complianceCss.rel = "stylesheet";
    complianceCss.href = path("assets/compliance.css");
    complianceCss.dataset.complianceCss = "true";
    document.head.appendChild(complianceCss);
  }

  const icon = (name) => {
    const icons = {
      menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
      close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
      arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
      portal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M4 10l8-5 8 5-8 5-8-5z"/><path d="M7 13v4c3 2 7 2 10 0v-4M20 10v6"/></svg>',
      message:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5z"/><path d="M8.5 10.2c.8 2.1 2.3 3.6 4.4 4.4"/></svg>'
    };
    return icons[name] || "";
  };

  const navItems = [
    ["home","Início",""], ["cursos","Cursos","cursos/"], ["turmas","Turmas","turmas/"], ["galeria","Galeria","galeria/"], ["faq","Dúvidas","faq/"]
  ];

  const header = document.querySelector("[data-site-header]");
  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="container nav-shell">
          <a class="brand" href="${path("")}" aria-label="FAESP Extensão Guaianases — página inicial">
            <img class="brand-logo" src="${path("assets/logo-faesp.jpg")}" alt="Logo da FAESP Extensão Guaianases">
            <span class="brand-copy"><strong>FAESP</strong><span>Extensão Guaianases</span></span>
          </a>
          <nav class="desktop-nav" aria-label="Navegação principal">
            ${navItems.map(([id,label,p])=>`<a class="nav-link ${page===id?'active':''}" href="${path(p)}"${page===id?' aria-current="page"':''}>${label}</a>`).join('')}
          </nav>
          <div class="nav-actions">
            <a class="btn btn-outline" href="${CONFIG.portal}" target="_blank" rel="noopener noreferrer"><span class="icon">${icon('portal')}</span>Portal do Aluno</a>
            <a class="btn btn-primary" data-registration href="${CONFIG.registration}">Inscreva-se<span class="icon">${icon('arrow')}</span></a>
          </div>
          <button class="mobile-toggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="mobile-menu"><span class="icon">${icon('menu')}</span></button>
        </div>
        <div class="mobile-panel" id="mobile-menu" aria-hidden="true">
          <div class="container">
            ${navItems.map(([id,label,p])=>`<a class="${page===id?'active':''}" href="${path(p)}"${page===id?' aria-current="page"':''}>${label}</a>`).join('')}
            <div class="mobile-actions">
              <a class="btn btn-outline" href="${CONFIG.portal}" target="_blank" rel="noopener noreferrer">Portal do Aluno</a>
              <a class="btn btn-primary" data-registration href="${CONFIG.registration}">Inscreva-se</a>
            </div>
          </div>
        </div>
      </header>`;
    const toggle = header.querySelector('.mobile-toggle');
    const panel = header.querySelector('.mobile-panel');
    const closeMobileMenu = (returnFocus=false) => {
      if (!panel?.classList.contains('open')) return;
      panel.classList.remove('open');
      document.body.classList.remove('menu-open');
      panel.setAttribute('aria-hidden','true');
      toggle?.setAttribute('aria-expanded','false');
      toggle?.setAttribute('aria-label','Abrir menu');
      if (toggle) toggle.innerHTML=`<span class="icon">${icon('menu')}</span>`;
      if (returnFocus) toggle?.focus();
    };
    toggle?.addEventListener('click',()=>{
      const open=panel.classList.toggle('open');
      document.body.classList.toggle('menu-open',open);
      panel.setAttribute('aria-hidden',String(!open));
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
      toggle.innerHTML=`<span class="icon">${icon(open?'close':'menu')}</span>`;
      if (open) panel.querySelector('a')?.focus();
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape' && panel?.classList.contains('open')) closeMobileMenu(true);
    });
  }

  const footer = document.querySelector("[data-site-footer]");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <div class="footer-brand"><img src="${path('assets/logo-faesp.jpg')}" alt="Logo FAESP"><div><strong>FAESP Extensão Guaianases</strong><span>Formação • Ensino • Serviço</span></div></div>
              <p class="footer-intro">Formação em Teologia com informação clara, atendimento local e vínculo institucional com a Faculdade Evangélica de São Paulo.</p>
              <img class="ministry-mark" src="${path('assets/logo-ministerio-belem.png')}" alt="Logo Assembleia de Deus Ministério do Belém">
            </div>
            <div class="footer-col"><h4>Navegação</h4>${navItems.slice(1).map(([id,label,p])=>`<a href="${path(p)}">${label}</a>`).join('')}<a href="${CONFIG.portal}" target="_blank" rel="noopener noreferrer">Portal do Aluno</a></div>
            <div class="footer-col"><h4>Legal e privacidade</h4><a href="${path('privacidade/')}">Política de Privacidade</a><a href="${path('termos/')}">Termos de Uso</a><a href="${path('cancelamento/')}">Cancelamento e Reembolso</a><a href="${path('acessibilidade/')}">Acessibilidade</a></div>
            <div class="footer-col"><h4>Contato</h4><a href="${CONFIG.whatsapp}" target="_blank" rel="noopener noreferrer">(11) 96224-8927</a><a href="mailto:${CONFIG.email}">${CONFIG.email}</a><p>Atendimento local:<br>Rua Capitão Pucci, 314<br>Guaianases, São Paulo – SP</p></div>
          </div>
          <div class="institutional-legal">
            <strong>${CONFIG.legalName} — FAESP</strong>
            <span>CNPJ ${CONFIG.cnpj}</span>
            <span>${CONFIG.institutionalAddress}</span>
            <a href="${CONFIG.officialExtensions}" target="_blank" rel="noopener noreferrer">Ver a Extensão Guaianases no site institucional</a>
          </div>
          <div class="footer-bottom"><span>© 2026 FAESP Extensão Guaianases. Todos os direitos reservados.</span><span>Assembleia de Deus Ministério do Belém</span></div>
        </div>
      </footer>`;
  }

  document.querySelectorAll('[data-registration]').forEach(el=>{
    el.href=CONFIG.registration;
    el.removeAttribute('target');
    el.removeAttribute('rel');
  });
  document.querySelectorAll('[data-whatsapp]').forEach(el=>{el.href=CONFIG.whatsapp;el.target='_blank';el.rel='noopener noreferrer'});
  document.querySelectorAll('[data-portal]').forEach(el=>{el.href=CONFIG.portal;el.target='_blank';el.rel='noopener noreferrer'});
  document.querySelectorAll('[data-email]').forEach(el=>{el.href=`mailto:${CONFIG.email}`;el.textContent=CONFIG.email});
  document.querySelectorAll('[data-pix]').forEach(el=>{el.textContent=CONFIG.pix});

  const float = document.createElement('a');
  float.className='whatsapp-float';
  float.href=CONFIG.whatsapp;
  float.target='_blank';
  float.rel='noopener noreferrer';
  float.setAttribute('aria-label','Falar com a FAESP Extensão Guaianases pelo WhatsApp');
  float.innerHTML=`<span class="icon">${icon('message')}</span>`;
  document.body.appendChild(float);

  document.querySelectorAll('.faq-question').forEach(btn=>btn.addEventListener('click',()=>{
    const item=btn.closest('.faq-item');
    const isOpen=item.classList.toggle('open');
    btn.setAttribute('aria-expanded',String(isOpen));
  }));

  const focusableSelector='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const trapFocus=(container,e)=>{
    if(e.key!=='Tab') return;
    const items=[...container.querySelectorAll(focusableSelector)].filter(el=>!el.hasAttribute('hidden') && el.offsetParent!==null);
    if(!items.length) return;
    const first=items[0], last=items[items.length-1];
    if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
  };

  const lightbox=document.querySelector('.lightbox');
  if(lightbox){
    const img=lightbox.querySelector('img');
    const closeBtn=lightbox.querySelector('.lightbox-close');
    let opener=null;
    const openLightbox=(item)=>{
      const source=item.querySelector('img');
      opener=item;
      img.src=source.src;
      img.alt=source.alt ? `${source.alt} — ampliada` : 'Foto ampliada';
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden','false');
      document.body.style.overflow='hidden';
      closeBtn?.focus();
    };
    const close=()=>{
      if(!lightbox.classList.contains('open')) return;
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden','true');
      document.body.style.overflow='';
      opener?.focus();
    };
    document.querySelectorAll('.gallery-item').forEach(item=>item.addEventListener('click',()=>openLightbox(item)));
    closeBtn?.addEventListener('click',close);
    lightbox.addEventListener('click',e=>{if(e.target===lightbox)close()});
    lightbox.addEventListener('keydown',e=>{trapFocus(lightbox,e);if(e.key==='Escape')close();});
  }

  const registrationModal=document.createElement('div');
  registrationModal.className='legal-modal';
  registrationModal.setAttribute('role','dialog');
  registrationModal.setAttribute('aria-modal','true');
  registrationModal.setAttribute('aria-labelledby','registration-title');
  registrationModal.setAttribute('aria-hidden','true');
  registrationModal.innerHTML=`
    <div class="legal-modal-card">
      <button class="legal-modal-close" type="button" aria-label="Fechar">×</button>
      <span class="eyebrow">Antes da inscrição</span>
      <h2 id="registration-title">Confirme que leu as condições</h2>
      <p>A inscrição continua no formulário oficial do Google. Os dados informados serão usados para atendimento, matrícula, gestão acadêmica e cobrança, conforme a Política de Privacidade.</p>
      <label class="legal-check"><input type="checkbox" data-terms-check> <span>Li e aceito os <a href="${path('termos/')}" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e as regras de <a href="${path('cancelamento/')}" target="_blank" rel="noopener noreferrer">Cancelamento e Reembolso</a>.</span></label>
      <label class="legal-check"><input type="checkbox" data-privacy-check> <span>Li a <a href="${path('privacidade/')}" target="_blank" rel="noopener noreferrer">Política de Privacidade</a> e estou ciente de como os dados da inscrição são tratados.</span></label>
      <p class="legal-small">Este site não utiliza Analytics ou pixels publicitários no código atual. A inscrição é processada em serviço externo do Google.</p>
      <div class="legal-modal-actions"><button class="btn btn-outline" type="button" data-registration-cancel>Cancelar</button><button class="btn btn-primary" type="button" data-registration-confirm disabled>Continuar para inscrição</button></div>
    </div>`;
  document.body.appendChild(registrationModal);

  const termsCheck=registrationModal.querySelector('[data-terms-check]');
  const privacyCheck=registrationModal.querySelector('[data-privacy-check]');
  const confirmRegistration=registrationModal.querySelector('[data-registration-confirm]');
  const cancelRegistration=registrationModal.querySelector('[data-registration-cancel]');
  const closeRegistration=registrationModal.querySelector('.legal-modal-close');
  let registrationOpener=null;

  const refreshRegistrationButton=()=>{
    confirmRegistration.disabled=!(termsCheck.checked && privacyCheck.checked);
  };
  const closeRegistrationModal=()=>{
    registrationModal.classList.remove('open');
    registrationModal.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
    registrationOpener?.focus();
  };
  const openRegistrationModal=(opener)=>{
    registrationOpener=opener;
    const stored=localStorage.getItem('faesp_terms_acceptance');
    let valid=false;
    try{
      const parsed=stored?JSON.parse(stored):null;
      valid=parsed?.version===TERMS_VERSION && parsed?.terms===true && parsed?.privacyAcknowledged===true;
    }catch(_){}
    if(valid){
      window.open(CONFIG.registration,'_blank','noopener,noreferrer');
      return;
    }
    termsCheck.checked=false;
    privacyCheck.checked=false;
    refreshRegistrationButton();
    registrationModal.classList.add('open');
    registrationModal.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    closeRegistration?.focus();
  };

  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-registration]');
    if(!trigger) return;
    e.preventDefault();
    openRegistrationModal(trigger);
  });

  [termsCheck,privacyCheck].forEach(check=>check.addEventListener('change',refreshRegistrationButton));
  cancelRegistration?.addEventListener('click',closeRegistrationModal);
  closeRegistration?.addEventListener('click',closeRegistrationModal);
  registrationModal.addEventListener('click',e=>{if(e.target===registrationModal)closeRegistrationModal();});
  registrationModal.addEventListener('keydown',e=>{
    trapFocus(registrationModal,e);
    if(e.key==='Escape') closeRegistrationModal();
  });
  confirmRegistration?.addEventListener('click',()=>{
    if(!(termsCheck.checked && privacyCheck.checked)) return;
    localStorage.setItem('faesp_terms_acceptance',JSON.stringify({
      version:TERMS_VERSION,
      terms:true,
      privacyAcknowledged:true,
      acceptedAt:new Date().toISOString()
    }));
    closeRegistrationModal();
    window.open(CONFIG.registration,'_blank','noopener,noreferrer');
  });
})();