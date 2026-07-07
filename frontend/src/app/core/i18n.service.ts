import { Injectable, Pipe, PipeTransform, inject, signal } from '@angular/core';

type Dict = Record<string, string>;

const EN: Dict = {
  dashboard: 'Dashboard', pipeline: 'Pipeline', accounts: 'Accounts', contacts: 'Contacts',
  sales: 'Sales', projects: 'Projects', activities: 'Activities', reports: 'Reports',
  settings: 'Settings', logout: 'Log out', search: 'Search…', login: 'Log in',
  email: 'Email', password: 'Password', welcome: 'Welcome to MaxSales CRM',
  opportunities: 'Opportunities', opportunity: 'Opportunity', account: 'Account',
  contact: 'Contact', owner: 'Owner', amount: 'Amount', stage: 'Stage', status: 'Status',
  probability: 'Probability', close_date: 'Close date', source: 'Source',
  product_line: 'Product line', next_step: 'Next step', competitors: 'Competitors',
  loss_reason: 'Loss reason', currency: 'Currency', name: 'Name', industry: 'Industry',
  segment: 'Segment', country: 'Country', website: 'Website', tax_id: 'Tax ID',
  annual_revenue: 'Annual revenue', notes: 'Notes', phone: 'Phone', whatsapp: 'WhatsApp',
  role_title: 'Role / Title', decision_maker: 'Decision maker', language: 'Language',
  new: 'New', edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel', close: 'Close',
  actions: 'Actions', confirm_delete: 'Delete this record? This cannot be undone.',
  no_results: 'Nothing here yet', loading: 'Loading…', total: 'Total', weighted: 'Weighted',
  win_rate: 'Win rate', forecast: 'Weighted forecast', pipeline_value: 'Pipeline value',
  sales_month: 'Sales this month', sales_quarter: 'Sales this quarter', target: 'Target',
  attainment: 'Attainment', top_open: 'Top open opportunities', overdue: 'Overdue activities',
  recently_closed: 'Recently closed', stale: 'Stale', stale_deals: 'stale deals',
  days_in_stage: 'days in stage', all_owners: 'All owners', all_lines: 'All product lines',
  all_quarters: 'All quarters', board: 'Board', list: 'List', won: 'Won', lost: 'Lost',
  open: 'Open', mark_won: 'Close as Won', mark_lost: 'Close as Lost',
  loss_reason_required: 'Loss reason is required', create_project_q: 'Also create a delivery project?',
  line_items: 'Line items', product: 'Product', quantity: 'Qty', unit_price: 'Unit price',
  discount: 'Discount %', add_item: 'Add item', stage_history: 'Stage history',
  audit_log: 'Audit log', timeline: 'Activity timeline', log_activity: 'Log activity',
  log_call: 'Log call', schedule_meeting: 'Schedule meeting', add_task: 'Add task',
  subject: 'Subject', description: 'Description', due_date: 'Due date', done: 'Done',
  type: 'Type', related_to: 'Related to', call: 'Call', meeting: 'Meeting', task: 'Task',
  note: 'Note', lifetime_revenue: 'Lifetime revenue', open_opps: 'Open opportunities',
  projects_tab: 'Projects', sales_tab: 'Sales', health: 'Health', progress: 'Progress',
  manager: 'Manager', start_date: 'Start date', end_date: 'End date', milestones: 'Milestones',
  add_milestone: 'Add milestone', planning: 'Planning', in_progress: 'In progress',
  blocked: 'Blocked', delivered: 'Delivered', closed: 'Closed', billing_type: 'Billing',
  one_off: 'One-off', recurring: 'Recurring', contract_value: 'Contract value',
  term_months: 'Term (months)', invoicing_status: 'Invoicing', not_invoiced: 'Not invoiced',
  partially_invoiced: 'Partially invoiced', invoiced: 'Invoiced', paid: 'Paid',
  mrr: 'MRR', arr: 'ARR', by_owner: 'By owner', by_product: 'By product line',
  by_country: 'By country', by_quarter: 'By quarter', funnel: 'Funnel', metrics: 'Metrics',
  loss_reasons: 'Loss reasons', export_csv: 'Export CSV', avg_deal: 'Average deal size',
  avg_cycle: 'Average sales cycle (days)', deals: 'deals', reached: 'Reached',
  conversion: 'Conversion to next', users: 'Users', stages: 'Stages', products: 'Products',
  currencies: 'Currencies', targets: 'Targets', general: 'General', org_name: 'Company name',
  base_currency: 'Base currency', stale_days: 'Stale after (days)', rate: 'Rate to base',
  year: 'Year', quarter: 'Quarter', active: 'Active', role: 'Role', admin: 'Admin',
  sales_manager: 'Sales manager', sales_rep: 'Sales rep', viewer: 'Viewer (read-only)',
  category: 'Category', is_recurring: 'Recurring', prospect: 'Prospect', churned: 'Churned',
  enterprise: 'Enterprise', smb: 'SMB', government: 'Government', quick_actions: 'Quick actions',
  demo_hint: 'Demo logins (password Demo123!)', per_page: 'per page', page: 'Page', of: 'of',
  filter: 'Filter…', order: 'Order', requires_amount: 'Requires amount & date',
  is_won_flag: 'Won stage', is_lost_flag: 'Lost stage', referral: 'Referral', event: 'Event',
  inbound: 'Inbound', outbound: 'Outbound', partner: 'Partner', add_contact: 'Add contact',
  view_all: 'View all', created: 'Created', last_activity: 'Last activity',
  no_activities: 'No activities yet — log the first one above.',
  duplicate_create_anyway: 'Create anyway',
  new_company: 'New company', switch_company: 'Switch company',
  create_company: 'Create company', your_name: 'Your name',
  signup_tag: 'Create your company workspace in seconds',
  have_account: 'Already have an account?', no_account: 'New here?',
  send_whatsapp: 'Send WhatsApp', send_email: 'Send email', recipient: 'Recipient',
  message: 'Message', template: 'Template', custom_recipient: 'Other (type below)',
  sent_logged: 'Sent and logged to the timeline',
  sent_link_logged: 'Opening WhatsApp/mail — press send there. Already logged in the CRM.',
  wa_hint: 'Sends from your own WhatsApp: the chat opens with the message pre-filled — press send once. Logged in the CRM either way.',
  tpl_follow_up: 'Follow-up', tpl_proposal: 'Proposal follow-up', tpl_meeting: 'Meeting request',
};

const PT: Dict = {
  dashboard: 'Painel', pipeline: 'Pipeline', accounts: 'Clientes', contacts: 'Contactos',
  sales: 'Vendas', projects: 'Projetos', activities: 'Atividades', reports: 'Relatórios',
  settings: 'Definições', logout: 'Sair', search: 'Pesquisar…', login: 'Entrar',
  email: 'Email', password: 'Palavra-passe', welcome: 'Bem-vindo ao MaxSales CRM',
  opportunities: 'Oportunidades', opportunity: 'Oportunidade', account: 'Cliente',
  contact: 'Contacto', owner: 'Responsável', amount: 'Valor', stage: 'Fase', status: 'Estado',
  probability: 'Probabilidade', close_date: 'Data de fecho', source: 'Origem',
  product_line: 'Linha de produto', next_step: 'Próximo passo', competitors: 'Concorrentes',
  loss_reason: 'Motivo da perda', currency: 'Moeda', name: 'Nome', industry: 'Setor',
  segment: 'Segmento', country: 'País', website: 'Website', tax_id: 'NIF',
  annual_revenue: 'Faturação anual', notes: 'Notas', phone: 'Telefone', whatsapp: 'WhatsApp',
  role_title: 'Cargo', decision_maker: 'Decisor', language: 'Idioma',
  new: 'Novo', edit: 'Editar', delete: 'Eliminar', save: 'Guardar', cancel: 'Cancelar',
  close: 'Fechar', actions: 'Ações', confirm_delete: 'Eliminar este registo? Não é reversível.',
  no_results: 'Ainda não há dados', loading: 'A carregar…', total: 'Total', weighted: 'Ponderado',
  win_rate: 'Taxa de sucesso', forecast: 'Previsão ponderada', pipeline_value: 'Valor do pipeline',
  sales_month: 'Vendas este mês', sales_quarter: 'Vendas este trimestre', target: 'Objetivo',
  attainment: 'Atingimento', top_open: 'Maiores oportunidades abertas', overdue: 'Atividades em atraso',
  recently_closed: 'Fechadas recentemente', stale: 'Parada', stale_deals: 'negócios parados',
  days_in_stage: 'dias na fase', all_owners: 'Todos os responsáveis', all_lines: 'Todas as linhas',
  all_quarters: 'Todos os trimestres', board: 'Quadro', list: 'Lista', won: 'Ganho', lost: 'Perdido',
  open: 'Aberto', mark_won: 'Fechar como Ganho', mark_lost: 'Fechar como Perdido',
  loss_reason_required: 'O motivo da perda é obrigatório', create_project_q: 'Criar também um projeto de entrega?',
  line_items: 'Itens', product: 'Produto', quantity: 'Qtd', unit_price: 'Preço unitário',
  discount: 'Desconto %', add_item: 'Adicionar item', stage_history: 'Histórico de fases',
  audit_log: 'Registo de auditoria', timeline: 'Cronologia de atividades', log_activity: 'Registar atividade',
  log_call: 'Registar chamada', schedule_meeting: 'Agendar reunião', add_task: 'Nova tarefa',
  subject: 'Assunto', description: 'Descrição', due_date: 'Data limite', done: 'Concluída',
  type: 'Tipo', related_to: 'Relacionado com', call: 'Chamada', meeting: 'Reunião', task: 'Tarefa',
  note: 'Nota', lifetime_revenue: 'Receita acumulada', open_opps: 'Oportunidades abertas',
  projects_tab: 'Projetos', sales_tab: 'Vendas', health: 'Saúde', progress: 'Progresso',
  manager: 'Gestor', start_date: 'Data de início', end_date: 'Data de fim', milestones: 'Marcos',
  add_milestone: 'Adicionar marco', planning: 'Planeamento', in_progress: 'Em curso',
  blocked: 'Bloqueado', delivered: 'Entregue', closed: 'Fechado', billing_type: 'Faturação',
  one_off: 'Pontual', recurring: 'Recorrente', contract_value: 'Valor do contrato',
  term_months: 'Prazo (meses)', invoicing_status: 'Faturação', not_invoiced: 'Não faturado',
  partially_invoiced: 'Parcialmente faturado', invoiced: 'Faturado', paid: 'Pago',
  mrr: 'MRR', arr: 'ARR', by_owner: 'Por responsável', by_product: 'Por linha de produto',
  by_country: 'Por país', by_quarter: 'Por trimestre', funnel: 'Funil', metrics: 'Métricas',
  loss_reasons: 'Motivos de perda', export_csv: 'Exportar CSV', avg_deal: 'Valor médio por negócio',
  avg_cycle: 'Ciclo médio de venda (dias)', deals: 'negócios', reached: 'Alcançaram',
  conversion: 'Conversão para a seguinte', users: 'Utilizadores', stages: 'Fases', products: 'Produtos',
  currencies: 'Moedas', targets: 'Objetivos', general: 'Geral', org_name: 'Nome da empresa',
  base_currency: 'Moeda base', stale_days: 'Parado após (dias)', rate: 'Taxa para moeda base',
  year: 'Ano', quarter: 'Trimestre', active: 'Ativo', role: 'Perfil', admin: 'Administrador',
  sales_manager: 'Gestor de vendas', sales_rep: 'Comercial', viewer: 'Executivo (leitura)',
  category: 'Categoria', is_recurring: 'Recorrente', prospect: 'Potencial', churned: 'Perdido',
  enterprise: 'Enterprise', smb: 'PME', government: 'Governo', quick_actions: 'Ações rápidas',
  demo_hint: 'Contas demo (palavra-passe Demo123!)', per_page: 'por página', page: 'Página', of: 'de',
  filter: 'Filtrar…', order: 'Ordem', requires_amount: 'Exige valor e data',
  is_won_flag: 'Fase de ganho', is_lost_flag: 'Fase de perda', referral: 'Referência', event: 'Evento',
  inbound: 'Inbound', outbound: 'Outbound', partner: 'Parceiro', add_contact: 'Adicionar contacto',
  view_all: 'Ver tudo', created: 'Criado', last_activity: 'Última atividade',
  no_activities: 'Sem atividades — registe a primeira acima.',
  duplicate_create_anyway: 'Criar mesmo assim',
  new_company: 'Nova empresa', switch_company: 'Mudar de empresa',
  create_company: 'Criar empresa', your_name: 'O seu nome',
  signup_tag: 'Crie o espaço da sua empresa em segundos',
  have_account: 'Já tem conta?', no_account: 'É novo por aqui?',
  send_whatsapp: 'Enviar WhatsApp', send_email: 'Enviar email', recipient: 'Destinatário',
  message: 'Mensagem', template: 'Modelo', custom_recipient: 'Outro (escreva abaixo)',
  sent_logged: 'Enviado e registado na cronologia',
  sent_link_logged: 'A abrir o WhatsApp/email — carregue em enviar lá. Já ficou registado no CRM.',
  wa_hint: 'Envia do seu próprio WhatsApp: a conversa abre com a mensagem preenchida — basta carregar em enviar. Fica registado no CRM.',
  tpl_follow_up: 'Seguimento', tpl_proposal: 'Seguimento de proposta', tpl_meeting: 'Pedido de reunião',
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  lang = signal<'en' | 'pt'>((localStorage.getItem('crm_lang') as 'en' | 'pt') || 'en');

  setLang(lang: 'en' | 'pt'): void {
    this.lang.set(lang);
    localStorage.setItem('crm_lang', lang);
  }

  t(key: string): string {
    const dict = this.lang() === 'pt' ? PT : EN;
    return dict[key] ?? EN[key] ?? key;
  }
}

@Pipe({ name: 'tr', standalone: true, pure: false })
export class TrPipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(key: string): string {
    return this.i18n.t(key);
  }
}
