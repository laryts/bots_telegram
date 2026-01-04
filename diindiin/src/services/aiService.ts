import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Education',
  'Travel',
  'Transfer',
  'Other'
];

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Bonus',
  'Rental',
  'Business',
  'Other'
];

export async function categorizeExpense(description: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a financial assistant. Categorize expenses into one of these categories: ${EXPENSE_CATEGORIES.join(', ')}. Return only the category name, nothing else.`,
        },
        {
          role: 'user',
          content: `Categorize this expense: "${description}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 10,
    });

    const category = completion.choices[0]?.message?.content?.trim() || 'Other';
    
    // Validate category
    if (EXPENSE_CATEGORIES.includes(category)) {
      return category;
    }
    
    return 'Other';
  } catch (error) {
    console.error('AI categorization error:', error);
    return 'Other';
  }
}

export async function categorizeIncome(description: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a financial assistant. Categorize income into one of these categories: ${INCOME_CATEGORIES.join(', ')}. Return only the category name, nothing else.`,
        },
        {
          role: 'user',
          content: `Categorize this income: "${description}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 10,
    });

    const category = completion.choices[0]?.message?.content?.trim() || 'Other';
    
    // Validate category
    if (INCOME_CATEGORIES.includes(category)) {
      return category;
    }
    
    return 'Other';
  } catch (error) {
    console.error('AI income categorization error:', error);
    return 'Other';
  }
}

export async function generateFinancialInsight(
  expenses: Array<{ category: string; total: number }>,
  totalExpenses: number
): Promise<string> {
  try {
    const expensesSummary = expenses
      .map(e => `${e.category}: ${e.total.toFixed(2)}`)
      .join(', ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a financial advisor. Provide brief, actionable insights about spending patterns. Be CONCISE and DIRECT. Maximum 2-3 short sentences. Keep it under 50 words.',
        },
        {
          role: 'user',
          content: `Total expenses: ${totalExpenses.toFixed(2)}. Breakdown: ${expensesSummary}. Provide insights.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    return completion.choices[0]?.message?.content?.trim() || 'No insights available.';
  } catch (error) {
    console.error('AI insight generation error:', error);
    return 'Unable to generate insights at this time.';
  }
}

export function getExpenseCategories(): string[] {
  return EXPENSE_CATEGORIES;
}

export function getIncomeCategories(): string[] {
  return INCOME_CATEGORIES;
}

export interface OKRStructure {
  title: string;
  description?: string;
  keyResults: Array<{
    title: string;
    targetValue?: number;
    currentValue?: number;
    unit?: string;
  }>;
  actions: Array<{
    description: string;
    keyResultTitle?: string; // Which KR this action belongs to
  }>;
  habits: Array<{
    name: string;
    frequencyType: 'daily' | 'weekly';
    frequencyValue?: number;
    description?: string;
    linkedActionDescription?: string; // Which action this habit should be linked to
  }>;
}

export async function parseOKRFromText(text: string, language: 'pt' | 'en' = 'pt'): Promise<OKRStructure> {
  try {
    const systemPrompt = language === 'pt'
      ? `Você é um assistente especializado em OKRs (Objectives and Key Results). 
Analise o texto fornecido pelo usuário e extraia:
1. O título do OKR (Objective) - SEMPRE presente
2. Key Results (KRs) com valores atuais e metas quando mencionados - SEMPRE crie pelo menos 1 KR se possível
3. Ações (Actions) relacionadas aos KRs - SEMPRE crie ações baseadas nas atividades mencionadas
4. Hábitos (Habits) - APENAS para atividades PERMANENTES e RECORRENTES

REGRAS IMPORTANTES:
- SEMPRE crie pelo menos 1 Key Result baseado no objetivo
- SEMPRE crie Actions para atividades/tarefas mencionadas no texto
- Crie Habits APENAS para atividades PERMANENTES e RECORRENTES como:
  * Beber água (diário)
  * Treinar/exercitar (semanal ou diário)
  * Arrumar a casa (semanal ou diário)
  * Organizar planilha (mensal, semanal)
  * Meditar, ler, estudar (recorrentes)
- NÃO crie habits para tarefas únicas ou temporárias (ex: "preparar gatos para viagem", "visitar locais", "pesquisar financiamento")
- Tarefas únicas ou temporárias devem ser apenas Actions
- Linke habits às actions relacionadas usando "linkedActionDescription"
- Se não houver valores numéricos explícitos, crie KRs qualitativos ou com valores estimados

Retorne APENAS um JSON válido no seguinte formato:
{
  "title": "título do OKR",
  "description": "descrição opcional",
  "keyResults": [
    {
      "title": "título do KR",
      "targetValue": número_meta,
      "currentValue": número_atual,
      "unit": "unidade (kg, cm, %, vezes, etc)"
    }
  ],
  "actions": [
    {
      "description": "descrição da ação",
      "keyResultTitle": "título do KR relacionado (opcional)"
    }
  ],
  "habits": [
    {
      "name": "nome do hábito",
      "frequencyType": "daily" ou "weekly",
      "frequencyValue": número (se weekly),
      "description": "descrição opcional",
      "linkedActionDescription": "descrição da ação relacionada (opcional)"
    }
  ]
}

Exemplo: Se o texto menciona "treinar 250x no ano", crie:
- KR: "Treinar" com targetValue: 250, unit: "vezes"
- Action: "Treinar" ou "Ir à academia"
- Habit: "Treinar" com frequencyType: "weekly" e linkedActionDescription: "Treinar"`
      : `You are an assistant specialized in OKRs (Objectives and Key Results).
Analyze the text provided by the user and extract:
1. The OKR title (Objective) - ALWAYS present
2. Key Results (KRs) with current and target values when mentioned - ALWAYS create at least 1 KR if possible
3. Actions related to the KRs - ALWAYS create actions based on mentioned activities
4. Habits - ONLY for PERMANENT and RECURRING activities

IMPORTANT RULES:
- ALWAYS create at least 1 Key Result based on the objective
- ALWAYS create Actions for activities/tasks mentioned in the text
- Create Habits ONLY for PERMANENT and RECURRING activities such as:
  * Drinking water (daily)
  * Training/exercising (weekly or daily)
  * Cleaning house (weekly or daily)
  * Organizing spreadsheet (monthly, weekly)
  * Meditating, reading, studying (recurring)
- DO NOT create habits for one-time or temporary tasks (e.g., "prepare cats for trip", "visit locations", "research financing")
- One-time or temporary tasks should be Actions only
- Link habits to related actions using "linkedActionDescription"
- If there are no explicit numeric values, create qualitative KRs or with estimated values

Return ONLY a valid JSON in the following format:
{
  "title": "OKR title",
  "description": "optional description",
  "keyResults": [
    {
      "title": "KR title",
      "targetValue": target_number,
      "currentValue": current_number,
      "unit": "unit (kg, cm, %, times, etc)"
    }
  ],
  "actions": [
    {
      "description": "action description",
      "keyResultTitle": "related KR title (optional)"
    }
  ],
  "habits": [
    {
      "name": "habit name",
      "frequencyType": "daily" or "weekly",
      "frequencyValue": number (if weekly),
      "description": "optional description",
      "linkedActionDescription": "related action description (optional)"
    }
  ]
}

Example: If text mentions "train 250x a year", create:
- KR: "Train" with targetValue: 250, unit: "times"
- Action: "Train" or "Go to gym"
- Habit: "Train" with frequencyType: "weekly" and linkedActionDescription: "Train"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt + (language === 'pt' 
            ? '\n\nIMPORTANTE: Retorne APENAS um JSON válido, sem texto adicional antes ou depois.'
            : '\n\nIMPORTANT: Return ONLY a valid JSON, no additional text before or after.'),
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(response) as OKRStructure;
    
    // Validate and set defaults
    if (!parsed.title) {
      throw new Error('No OKR title found');
    }
    
    if (!parsed.keyResults) {
      parsed.keyResults = [];
    }
    
    if (!parsed.actions) {
      parsed.actions = [];
    }
    
    if (!parsed.habits) {
      parsed.habits = [];
    }

    return parsed;
  } catch (error) {
    console.error('AI OKR parsing error:', error);
    throw error;
  }
}

export async function generateAIInsight(
  category: 'habits' | 'okrs' | 'incomes' | 'outcomes' | 'investments',
  userData: string,
  question?: string,
  language: 'pt' | 'en' = 'pt'
): Promise<string> {
  try {
    const systemPrompts: Record<string, string> = {
      habits: language === 'pt'
        ? 'Você é um especialista em hábitos e produtividade. Analise os dados fornecidos e forneça insights acionáveis e conselhos práticos. Seja específico e útil. IMPORTANTE: Seja CONCISO e DIRETO. Máximo de 3-4 frases curtas. Evite explicações longas.'
        : 'You are a habits and productivity expert. Analyze the provided data and give actionable insights and practical advice. Be specific and helpful. IMPORTANT: Be CONCISE and DIRECT. Maximum 3-4 short sentences. Avoid long explanations.',
      okrs: language === 'pt'
        ? 'Você é um especialista em OKRs (Objectives and Key Results). Analise os dados fornecidos e forneça insights sobre progresso, ações recomendadas e estratégias para alcançar os objetivos. IMPORTANTE: Seja CONCISO e DIRETO. Máximo de 3-4 frases curtas. Evite explicações longas.'
        : 'You are an OKRs (Objectives and Key Results) expert. Analyze the provided data and provide insights on progress, recommended actions and strategies to achieve objectives. IMPORTANT: Be CONCISE and DIRECT. Maximum 3-4 short sentences. Avoid long explanations.',
      incomes: language === 'pt'
        ? 'Você é um consultor financeiro especializado em receitas e ganhos. Analise os dados fornecidos e forneça insights sobre como aumentar a renda e gerar receitas extras. IMPORTANTE: Seja CONCISO e DIRETO. Máximo de 3-4 frases curtas. Evite explicações longas.'
        : 'You are a financial consultant specialized in income and earnings. Analyze the provided data and provide insights on how to increase income and generate extra revenue. IMPORTANT: Be CONCISE and DIRECT. Maximum 3-4 short sentences. Avoid long explanations.',
      outcomes: language === 'pt'
        ? 'Você é um consultor financeiro especializado em despesas e economia. Analise os dados fornecidos e forneça insights sobre como economizar dinheiro e reduzir gastos desnecessários. IMPORTANTE: Seja CONCISO e DIRETO. Máximo de 3-4 frases curtas. Evite explicações longas.'
        : 'You are a financial consultant specialized in expenses and savings. Analyze the provided data and provide insights on how to save money and reduce unnecessary spending. IMPORTANT: Be CONCISE and DIRECT. Maximum 3-4 short sentences. Avoid long explanations.',
      investments: language === 'pt'
        ? 'Você é um consultor financeiro especializado em investimentos. Analise os dados fornecidos e forneça insights e dicas sobre investimentos, estratégias e oportunidades. IMPORTANTE: Seja CONCISO e DIRETO. Máximo de 3-4 frases curtas. Evite explicações longas.'
        : 'You are a financial consultant specialized in investments. Analyze the provided data and provide insights and tips on investments, strategies and opportunities. IMPORTANT: Be CONCISE and DIRECT. Maximum 3-4 short sentences. Avoid long explanations.',
    };

    const userPrompt = question
      ? `${userData}\n\nPergunta do usuário: ${question}`
      : `${userData}\n\nForneça um overview geral e relatório com insights e recomendações.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompts[category],
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content?.trim() || (language === 'pt' ? 'Não foi possível gerar insights no momento.' : 'Unable to generate insights at this time.');
  } catch (error) {
    console.error(`AI ${category} insight generation error:`, error);
    throw error;
  }
}

