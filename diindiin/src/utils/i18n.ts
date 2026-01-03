export type Language = 'en' | 'pt';

export interface Translations {
  commands: {
    add: string;
    list: string;
    show: string;
    update: string;
    help: string;
    start: string;
    report: string;
    categories: string;
    income: string;
    incomes: string;
    investment: string;
    investments: string;
    habit: string;
    habits: string;
    okr: string;
    okrs: string;
    objective: string;
    keyResult: string;
    action: string;
    spreadsheet: string;
    language: string;
  };
  entities: {
    expense: string;
    income: string;
    investment: string;
    habit: string;
    objective: string;
    keyResult: string;
    action: string;
    contribution: string;
  };
  messages: {
    welcome: string;
    welcomeBack: string;
    referralCode: string;
    useHelp: string;
    referredByFriend: string;
    availableCommands: string;
    expenseAdded: string;
    incomeAdded: string;
    investmentAdded: string;
    habitAdded: string;
    objectiveAdded: string;
    keyResultAdded: string;
    actionAdded: string;
    progressUpdated: string;
    habitLogged: string;
    languageChanged: string;
    invalidAmount: string;
    invalidValue: string;
    invalidDate: string;
    invalidId: string;
    notFound: string;
    error: string;
    pleaseStart: string;
    usage: string;
    example: string;
    examples: string;
    amount: string;
    description: string;
    category: string;
    date: string;
    frequency: string;
    countedAsDay: string;
    languageSetTo: string;
    currentLanguage: string;
    selectLanguage: string;
    languageNotSupported: string;
  };
  errors: {
    generic: string;
    addingExpense: string;
    addingIncome: string;
    addingInvestment: string;
    addingHabit: string;
    addingObjective: string;
    addingKeyResult: string;
    addingAction: string;
    updatingProgress: string;
    loggingHabit: string;
    startingBot: string;
    gettingReferral: string;
    changingLanguage: string;
  };
}

const translations: Record<Language, Translations> = {
  en: {
    commands: {
      add: 'Add',
      list: 'List',
      show: 'Show',
      update: 'Update',
      help: 'Help',
      start: 'Start',
      report: 'Report',
      categories: 'Categories',
      income: 'Income',
      incomes: 'Incomes',
      investment: 'Investment',
      investments: 'Investments',
      habit: 'Habit',
      habits: 'Habits',
      okr: 'OKR',
      okrs: 'OKRs',
      objective: 'Objective',
      keyResult: 'Key Result',
      action: 'Action',
      spreadsheet: 'Spreadsheet',
      language: 'Language',
    },
    entities: {
      expense: 'expense',
      income: 'income',
      investment: 'investment',
      habit: 'habit',
      objective: 'objective',
      keyResult: 'key result',
      action: 'action',
      contribution: 'contribution',
    },
    messages: {
      welcome: 'Welcome to Diindiin! 👋',
      welcomeBack: 'Welcome back',
      referralCode: 'Your referral code',
      useHelp: 'Use /help to see available commands.',
      referredByFriend: 'You were referred by a friend! 🎉',
      availableCommands: 'Available commands:',
      expenseAdded: '✅ Expense added!',
      incomeAdded: '✅ Income added!',
      investmentAdded: '✅ Investment added!',
      habitAdded: '✅ Habit added!',
      objectiveAdded: '✅ Objective added!',
      keyResultAdded: '✅ Key result added!',
      actionAdded: '✅ Action added!',
      progressUpdated: '✅ Progress updated!',
      habitLogged: '✅ Habit logged!',
      languageChanged: '✅ Language changed!',
      invalidAmount: '❌ Invalid amount. Please provide a valid number.',
      invalidValue: '❌ Invalid value. Please provide a valid number.',
      invalidDate: '❌ Invalid date format. Use YYYY-MM-DD',
      invalidId: '❌ Invalid ID.',
      notFound: '❌ Not found.',
      error: '❌ Error',
      pleaseStart: 'Please start the bot first with /start',
      usage: 'Usage',
      example: 'Example',
      examples: 'Examples',
      amount: 'Amount',
      description: 'Description',
      category: 'Category',
      date: 'Date',
      frequency: 'Frequency',
      countedAsDay: 'Counted as 1 day!',
      languageSetTo: 'Language set to',
      currentLanguage: 'Current language',
      selectLanguage: 'Select your language',
      languageNotSupported: 'Language not supported. Using Portuguese (pt).',
    },
    errors: {
      generic: '❌ An error occurred. Please try again.',
      addingExpense: '❌ Error adding expense. Please try again.',
      addingIncome: '❌ Error adding income. Please try again.',
      addingInvestment: '❌ Error adding investment. Please try again.',
      addingHabit: '❌ Error adding habit. Please try again.',
      addingObjective: '❌ Error adding objective. Please try again.',
      addingKeyResult: '❌ Error adding key result. Please try again.',
      addingAction: '❌ Error adding action. Please try again.',
      updatingProgress: '❌ Error updating progress. Please try again.',
      loggingHabit: '❌ Error logging habit. Please try again.',
      startingBot: '❌ Error starting bot. Please try again.',
      gettingReferral: '❌ Error getting referral link. Please try again.',
      changingLanguage: '❌ Error changing language. Please try again.',
    },
  },
  pt: {
    commands: {
      add: 'Adicionar',
      list: 'Listar',
      show: 'Mostrar',
      update: 'Atualizar',
      help: 'Ajuda',
      start: 'Iniciar',
      report: 'Relatório',
      categories: 'Categorias',
      income: 'Receita',
      incomes: 'Receitas',
      investment: 'Investimento',
      investments: 'Investimentos',
      habit: 'Hábito',
      habits: 'Hábitos',
      okr: 'OKR',
      okrs: 'OKRs',
      objective: 'Objetivo',
      keyResult: 'Resultado-chave',
      action: 'Ação',
      spreadsheet: 'Planilha',
      language: 'Idioma',
    },
    entities: {
      expense: 'despesa',
      income: 'receita',
      investment: 'investimento',
      habit: 'hábito',
      objective: 'objetivo',
      keyResult: 'resultado-chave',
      action: 'ação',
      contribution: 'contribuição',
    },
    messages: {
      welcome: 'Bem-vindo ao Diindiin! 👋',
      welcomeBack: 'Bem-vindo de volta',
      referralCode: 'Seu código de indicação',
      useHelp: 'Use /help para ver os comandos disponíveis.',
      referredByFriend: 'Você foi indicado por um amigo! 🎉',
      availableCommands: 'Comandos disponíveis:',
      expenseAdded: '✅ Despesa adicionada!',
      incomeAdded: '✅ Receita adicionada!',
      investmentAdded: '✅ Investimento adicionado!',
      habitAdded: '✅ Hábito adicionado!',
      objectiveAdded: '✅ Objetivo adicionado!',
      keyResultAdded: '✅ Resultado-chave adicionado!',
      actionAdded: '✅ Ação adicionada!',
      progressUpdated: '✅ Progresso atualizado!',
      habitLogged: '✅ Hábito registrado!',
      languageChanged: '✅ Idioma alterado!',
      invalidAmount: '❌ Valor inválido. Por favor, forneça um número válido.',
      invalidValue: '❌ Valor inválido. Por favor, forneça um número válido.',
      invalidDate: '❌ Formato de data inválido. Use AAAA-MM-DD',
      invalidId: '❌ ID inválido.',
      notFound: '❌ Não encontrado.',
      error: '❌ Erro',
      pleaseStart: 'Por favor, inicie o bot primeiro com /start',
      usage: 'Uso',
      example: 'Exemplo',
      examples: 'Exemplos',
      amount: 'Valor',
      description: 'Descrição',
      category: 'Categoria',
      date: 'Data',
      frequency: 'Frequência',
      countedAsDay: 'Contado como 1 dia!',
      languageSetTo: 'Idioma definido para',
      currentLanguage: 'Idioma atual',
      selectLanguage: 'Selecione seu idioma',
      languageNotSupported: 'Idioma não suportado. Usando Português (pt).',
    },
    errors: {
      generic: '❌ Ocorreu um erro. Por favor, tente novamente.',
      addingExpense: '❌ Erro ao adicionar despesa. Por favor, tente novamente.',
      addingIncome: '❌ Erro ao adicionar receita. Por favor, tente novamente.',
      addingInvestment: '❌ Erro ao adicionar investimento. Por favor, tente novamente.',
      addingHabit: '❌ Erro ao adicionar hábito. Por favor, tente novamente.',
      addingObjective: '❌ Erro ao adicionar objetivo. Por favor, tente novamente.',
      addingKeyResult: '❌ Erro ao adicionar resultado-chave. Por favor, tente novamente.',
      addingAction: '❌ Erro ao adicionar ação. Por favor, tente novamente.',
      updatingProgress: '❌ Erro ao atualizar progresso. Por favor, tente novamente.',
      loggingHabit: '❌ Erro ao registrar hábito. Por favor, tente novamente.',
      startingBot: '❌ Erro ao iniciar o bot. Por favor, tente novamente.',
      gettingReferral: '❌ Erro ao obter link de indicação. Por favor, tente novamente.',
      changingLanguage: '❌ Erro ao alterar idioma. Por favor, tente novamente.',
    },
  },
};

/**
 * Normalize language code from Telegram (e.g., 'pt-BR', 'en-US') to our supported languages ('pt', 'en')
 */
export function normalizeLanguage(languageCode?: string): Language {
  if (!languageCode) return 'pt';
  
  const normalized = languageCode.toLowerCase().split('-')[0];
  return normalized === 'en' ? 'en' : 'pt';
}

/**
 * Get translation for a specific key in the given language
 */
export function t(language: Language, key: string): string {
  const keys = key.split('.');
  let value: any = translations[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to Portuguese if key not found
      value = translations['pt'];
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return key; // Return key if translation not found
        }
      }
      break;
    }
  }
  
  return typeof value === 'string' ? value : key;
}

/**
 * Get all translations for a language
 */
export function getTranslations(language: Language): Translations {
  return translations[language];
}

