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

