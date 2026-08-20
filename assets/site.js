(() => {
  const CONFIG = {
    registration: "https://docs.google.com/forms/u/0/d/e/1FAIpQLSeT2rxU7fJEGInjbVW6CXd04wQixTWRvakBGSvZak0doia8fQ/viewform?fbclid=PAZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQPNTY3MDY3MzQzMzUyNDI3AAGndcsaYupniHHJoXWKV0rHlkxjdU40XFFQXhxZp4mBX4yq3F7rK_OZ_pP6BW4_aem_4eg0GegRbyA2KHM-2uJzQw&pli=1&authuser=0",
    whatsapp: "https://wa.me/5511962248927",
    portal: "https://aluno.adm-faesp.org/login/",
    email: "faespguaianases@gmail.com",
    pix: "coordenacao.faesp07@gmail.com"
  };
  window.FAESP_CONFIG = CONFIG;

  const base = document.documentElement.dataset.base || ".";
  const page = document.body.dataset.page || "home";
  const path = (p="") => `${base}/${p}`.replace(/\/\/$/, "/");
  const icon = (name) => {
    const icons = {
      menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
      close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
      arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
      portal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 10l8-5 8 5-8 5-8-5z"/><path d="M7 13v4c3 2 7 2 10 0v-4M20 10v6"/></svg>',
      message:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5z"/><path d="M8.5 10.2c.8 2.1 2.3 3.6 4.4 4.4"/></svg>'
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
          <a class="brand" href="${path("")}">
            <img class="brand-logo" src="${path("assets/logo-faesp.jpg")}" alt="FAESP Extensão Guaianases">
            <span class="brand-copy"><strong>FAESP</strong><span>Extensão Guaianases</span></span>
          </a>
          <nav class="desktop-nav" aria-label="Navegação principal">
            ${navItems.map(([id,label,p])=>`<a class="nav-link ${page===id?'active':''}" href="${path(p)}">${label}</a>`).join('')}
          </nav>
          <div class="nav-actions">
            <a class="btn btn-outline" href="${CONFIG.portal}" target="_blank" rel="noopener"><span class="icon">${icon('portal')}</span>Portal do Aluno</a>
            <a class="btn btn-primary" href="${CONFIG.registration}" target="_blank" rel="noopener">Inscreva-se<span class="icon">${icon('arrow')}</span></a>
          </div>
          <button class="mobile-toggle" type="button" aria-label="Abrir menu" aria-expanded="false"><span class="icon">${icon('menu')}</span></button>
        </div>
        <div class="mobile-panel">
          <div class="container">
            ${navItems.map(([id,label,p])=>`<a class="${page===id?'active':''}" href="${path(p)}">${label}</a>`).join('')}
            <div class="mobile-actions">
              <a class="btn btn-outline" href="${CONFIG.portal}" target="_blank" rel="noopener">Portal do Aluno</a>
              <a class="btn btn-primary" href="${CONFIG.registration}" target="_blank" rel="noopener">Inscreva-se</a>
            </div>
          </div>
        </div>
      </header>`;
    const toggle = header.querySelector('.mobile-toggle');
    const panel = header.querySelector('.mobile-panel');
    toggle?.addEventListener('click',()=>{
      const open=panel.classList.toggle('open');
      document.body.classList.toggle('menu-open',open);
      toggle.setAttribute('aria-expanded',String(open));
      toggle.innerHTML=`<span class="icon">${icon(open?'close':'menu')}</span>`;
    });
  }

  const footer = document.querySelector("[data-site-footer]");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <div class="footer-brand"><img src="${path('assets/logo-faesp.jpg')}" alt="FAESP"><div><strong>FAESP Extensão Guaianases</strong><span>Formação • Ensino • Serviço</span></div></div>
              <p class="footer-intro">Formação em Teologia com excelência, flexibilidade e propósito ministerial.</p>
              <img class="ministry-mark" src="${path('assets/logo-ministerio-belem.png')}" alt="Assembleia de Deus Ministério do Belém">
            </div>
            <div class="footer-col"><h4>Navegação</h4>${navItems.slice(1).map(([id,label,p])=>`<a href="${path(p)}">${label}</a>`).join('')}<a href="${CONFIG.portal}" target="_blank" rel="noopener">Portal do Aluno</a></div>
            <div class="footer-col"><h4>Contato</h4><a href="${CONFIG.whatsapp}" target="_blank" rel="noopener">(11) 96224-8927</a><a href="mailto:${CONFIG.email}">${CONFIG.email}</a><p>Rua Capitão Pucci, 314<br>Guaianases, São Paulo – SP</p></div>
          </div>
          <div class="footer-bottom"><span>© 2026 FAESP Extensão Guaianases. Todos os direitos reservados.</span><span>Assembleia de Deus Ministério do Belém</span></div>
        </div>
      </footer>`;
  }

  document.querySelectorAll('[data-registration]').forEach(el=>{el.href=CONFIG.registration;el.target='_blank';el.rel='noopener'});
  document.querySelectorAll('[data-whatsapp]').forEach(el=>{el.href=CONFIG.whatsapp;el.target='_blank';el.rel='noopener'});
  document.querySelectorAll('[data-portal]').forEach(el=>{el.href=CONFIG.portal;el.target='_blank';el.rel='noopener'});
  document.querySelectorAll('[data-email]').forEach(el=>{el.href=`mailto:${CONFIG.email}`;el.textContent=CONFIG.email});
  document.querySelectorAll('[data-pix]').forEach(el=>{el.textContent=CONFIG.pix});

  const float = document.createElement('a');
  float.className='whatsapp-float'; float.href=CONFIG.whatsapp; float.target='_blank'; float.rel='noopener'; float.setAttribute('aria-label','Falar pelo WhatsApp');
  float.innerHTML=`<span class="icon">${icon('message')}</span>`; document.body.appendChild(float);

  document.querySelectorAll('.faq-question').forEach(btn=>btn.addEventListener('click',()=>{
    const item=btn.closest('.faq-item'); const isOpen=item.classList.toggle('open'); btn.setAttribute('aria-expanded',String(isOpen));
  }));

  const lightbox=document.querySelector('.lightbox');
  if(lightbox){
    const img=lightbox.querySelector('img');
    document.querySelectorAll('.gallery-item').forEach(item=>item.addEventListener('click',()=>{img.src=item.querySelector('img').src; lightbox.classList.add('open'); document.body.style.overflow='hidden'}));
    const close=()=>{lightbox.classList.remove('open');document.body.style.overflow=''};
    lightbox.querySelector('.lightbox-close')?.addEventListener('click',close); lightbox.addEventListener('click',e=>{if(e.target===lightbox)close()}); document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  }
})();
