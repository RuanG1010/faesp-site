# Conformidade e acessibilidade — FAESP Extensão Guaianases

Última revisão técnica: 24/10/2026.

## Implementado no repositório

- Política de Privacidade publicada em `/privacidade/`.
- Termos de Uso publicados em `/termos/`.
- Política de Cancelamento e Reembolso publicada em `/cancelamento/`.
- Declaração e canal de acessibilidade em `/acessibilidade/`.
- Dados institucionais e CNPJ exibidos no rodapé, com referência à página oficial de Extensões da FAESP.
- Aceite explícito de Termos e ciência da Política de Privacidade antes do redirecionamento ao formulário de inscrição.
- Registro local da versão/data do aceite no navegador (`faesp_terms_acceptance`).
- Sem Google Analytics, GTM ou pixels publicitários identificados no código atual.
- Correção de contraste dos textos pequenos anteriormente abaixo de 4,5:1.
- Foco visível reforçado.
- Menu móvel com estado ARIA e fechamento por Escape.
- Lightbox da galeria com gerenciamento de foco, contenção de Tab, Escape e retorno de foco.
- Imagens externas da galeria com `referrerpolicy="no-referrer"`.
- Horários noturnos publicados padronizados para 19h30.
- Páginas antigas do repositório redirecionadas para a versão atual.

## Dependências externas que exigem verificação operacional

Estes itens não podem ser comprovados ou corrigidos apenas pelo repositório estático:

1. **Google Forms de inscrição**
   - revisar todos os campos coletados;
   - remover campos sem finalidade necessária;
   - incluir links para Privacidade, Termos e Cancelamento dentro do próprio formulário;
   - manter evidência centralizada do aceite da versão dos Termos no cadastro, além do registro local feito pelo site;
   - confirmar onde as respostas são armazenadas e quem tem acesso.

2. **Portal do Aluno (`aluno.adm-faesp.org`)**
   - mapear banco, hospedagem, backups, logs e fornecedores;
   - definir prazos de retenção;
   - validar processo de acesso, correção e eliminação de dados;
   - verificar segurança de autenticação e política de senhas.

3. **Fornecedores e contratos**
   - Google, Meta/WhatsApp, provedor do Portal, hospedagem e demais serviços devem ter contratos/políticas revisados quanto a tratamento, retenção e eventual transferência internacional de dados.

4. **Imagens, logos e conteúdo**
   - manter comprovação de licença, autoria ou autorização de uso;
   - manter autorização de uso de imagem das pessoas identificáveis nas fotografias, quando necessária.

5. **Teste de produção**
   - executar Lighthouse/axe/WAVE e teste manual de teclado/leitor de tela no endereço efetivamente publicado;
   - conferir cookies, Local Storage e requisições de rede no navegador antes e depois da interação do usuário;
   - repetir a auditoria após qualquer inclusão de Analytics, pixel, chat, CRM ou nova integração.

## Regra de manutenção

Qualquer nova integração que receba dados do usuário deve ser registrada na Política de Privacidade antes ou no mesmo momento da publicação. Qualquer nova ferramenta de analytics/publicidade deve ser avaliada quanto à necessidade de consentimento prévio antes do carregamento.
