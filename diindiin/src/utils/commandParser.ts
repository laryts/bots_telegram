import { Language, t } from './i18n';

export type EntityType = 'expense' | 'income' | 'investment' | 'habit' | 'objective' | 'keyResult' | 'action' | 'contribution';
export type CommandAction = 'add' | 'list' | 'update' | 'show' | 'view';

export interface ParsedCommand {
  action: CommandAction;
  entityType: EntityType | null;
  args: string[];
  originalText: string;
}

// Keywords for entity detection in both languages
const entityKeywords: Record<EntityType, { en: string[]; pt: string[] }> = {
  expense: {
    en: ['expense', 'expenses', 'spending', 'spend', 'cost', 'costs', 'gasto', 'gastos'],
    pt: ['despesa', 'despesas', 'gasto', 'gastos', 'gastar'],
  },
  income: {
    en: ['income', 'incomes', 'salary', 'salaries', 'earnings', 'earning'],
    pt: ['receita', 'receitas', 'salário', 'salários', 'ganho', 'ganhos'],
  },
  investment: {
    en: ['investment', 'investments', 'invest', 'investing'],
    pt: ['investimento', 'investimentos', 'investir'],
  },
  habit: {
    en: ['habit', 'habits'],
    pt: ['hábito', 'hábitos', 'habito', 'habitos'],
  },
  objective: {
    en: ['objective', 'objectives', 'goal', 'goals'],
    pt: ['objetivo', 'objetivos', 'meta', 'metas'],
  },
  keyResult: {
    en: ['key result', 'key results', 'kr', 'krs'],
    pt: ['resultado-chave', 'resultado chave', 'resultados-chave', 'resultados chave', 'rc', 'rcs'],
  },
  action: {
    en: ['action', 'actions', 'task', 'tasks'],
    pt: ['ação', 'acoes', 'ações', 'acoes', 'tarefa', 'tarefas'],
  },
  contribution: {
    en: ['contribution', 'contributions'],
    pt: ['contribuição', 'contribuicoes', 'contribuições', 'contribuicoes'],
  },
};

// Command action keywords in both languages
const actionKeywords: Record<CommandAction, { en: string[]; pt: string[] }> = {
  add: {
    en: ['add', 'create', 'new', 'insert'],
    pt: ['adicionar', 'adiciona', 'criar', 'cria', 'novo', 'nova', 'inserir'],
  },
  list: {
    en: ['list', 'show', 'view', 'see', 'all'],
    pt: ['listar', 'lista', 'mostrar', 'mostra', 'ver', 'ver todos', 'todos', 'todas'],
  },
  update: {
    en: ['update', 'edit', 'change', 'modify'],
    pt: ['atualizar', 'atualiza', 'editar', 'edita', 'alterar', 'altera', 'modificar'],
  },
  show: {
    en: ['show', 'view', 'see', 'display'],
    pt: ['mostrar', 'mostra', 'ver', 'visualizar', 'exibir'],
  },
  view: {
    en: ['view', 'see', 'show', 'display'],
    pt: ['ver', 'visualizar', 'mostrar', 'mostra', 'exibir'],
  },
};

/**
 * Detect entity type from text in both languages
 */
export function detectEntityType(text: string, language: Language): EntityType | null {
  const lowerText = text.toLowerCase().trim();
  
  for (const [entityType, keywords] of Object.entries(entityKeywords)) {
    const langKeywords = keywords[language];
    if (langKeywords.some(keyword => lowerText.includes(keyword))) {
      return entityType as EntityType;
    }
  }
  
  return null;
}

/**
 * Detect command action from text in both languages
 */
export function detectAction(text: string, language: Language): CommandAction | null {
  const lowerText = text.toLowerCase().trim();
  
  for (const [action, keywords] of Object.entries(actionKeywords)) {
    const langKeywords = keywords[language];
    if (langKeywords.some(keyword => lowerText === keyword || lowerText.startsWith(keyword + ' '))) {
      return action as CommandAction;
    }
  }
  
  return null;
}

/**
 * Parse command text to extract action, entity type, and arguments
 */
export function parseCommand(text: string, language: Language): ParsedCommand {
  const parts = text.trim().split(/\s+/);
  const originalText = text;
  
  if (parts.length === 0) {
    return {
      action: 'list',
      entityType: null,
      args: [],
      originalText,
    };
  }
  
  // Try to detect action from first part
  let action: CommandAction = 'list'; // Default
  let entityType: EntityType | null = null;
  let args: string[] = [];
  
  // Check if first part is an action
  const detectedAction = detectAction(parts[0], language);
  if (detectedAction) {
    action = detectedAction;
    args = parts.slice(1);
  } else {
    // If no action detected, assume it's arguments
    args = parts;
  }
  
  // Try to detect entity type from first argument
  if (args.length > 0) {
    const detectedEntity = detectEntityType(args[0], language);
    if (detectedEntity) {
      entityType = detectedEntity;
      args = args.slice(1); // Remove entity keyword from args
    }
  }
  
  return {
    action,
    entityType,
    args,
    originalText,
  };
}

/**
 * Helper function to parse quoted strings from command arguments
 */
export function parseArgs(text: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        args.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  return args;
}

/**
 * Get entity type name in the user's language
 */
export function getEntityName(entityType: EntityType, language: Language): string {
  return t(language, `entities.${entityType}`);
}

