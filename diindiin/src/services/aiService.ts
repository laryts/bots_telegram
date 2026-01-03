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
          content: 'You are a financial advisor. Provide brief, actionable insights about spending patterns. Keep it under 100 words.',
        },
        {
          role: 'user',
          content: `Total expenses: ${totalExpenses.toFixed(2)}. Breakdown: ${expensesSummary}. Provide insights.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
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
4. Hábitos (Habits) mencionados com suas frequências - SEMPRE crie hábitos para atividades recorrentes mencionadas

REGRAS IMPORTANTES:
- SEMPRE crie pelo menos 1 Key Result baseado no objetivo
- SEMPRE crie Actions para atividades/tarefas mencionadas no texto
- SEMPRE crie Habits para atividades recorrentes (treino, dieta, beber água, etc.)
- Se uma ação menciona uma atividade recorrente, crie um hábito para ela
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
4. Habits mentioned with their frequencies - ALWAYS create habits for recurring activities mentioned

IMPORTANT RULES:
- ALWAYS create at least 1 Key Result based on the objective
- ALWAYS create Actions for activities/tasks mentioned in the text
- ALWAYS create Habits for recurring activities (training, diet, drinking water, etc.)
- If an action mentions a recurring activity, create a habit for it
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

