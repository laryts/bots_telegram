import { Context } from 'telegraf';
import { getUserByTelegramId, getUserLanguage } from '../models/User';
import { createIncome, getMonthlyIncomes, getIncomesByCategory, getTotalIncomesByMonth } from '../models/Income';
import { categorizeIncome } from '../services/aiService';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { nowInTimezone } from '../utils/timezone';
import { t } from '../utils/i18n';

export async function handleAddIncome(ctx: Context, amount: number, description: string) {
  try {
    const language = await getUserLanguage(ctx.from!.id.toString());
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply(t(language, 'messages.pleaseStart'));
    }

    // Use AI to categorize income
    const category = await categorizeIncome(description);

    const timezone = user.timezone || 'America/Sao_Paulo';
    const income = await createIncome(user.id, amount, description, category, timezone);

    await ctx.reply(
      `${t(language, 'messages.incomeAdded')}\n\n` +
      `💰 ${t(language, 'messages.amount')}: R$ ${amount.toFixed(2)}\n` +
      `📝 ${t(language, 'messages.description')}: ${description}\n` +
      `🏷️ ${t(language, 'messages.category')}: ${category}`
    );
  } catch (error: any) {
    console.error('Error adding income:', error);
    const language = await getUserLanguage(ctx.from!.id.toString());
    
    // Check if table doesn't exist
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return ctx.reply(
        language === 'pt'
          ? '❌ A tabela de receitas não existe. Por favor, execute a migração:\nExecute o SQL de migrations/003_add_incomes.sql no seu banco de dados.'
          : '❌ Incomes table does not exist. Please run the migration:\nExecute the SQL from migrations/003_add_incomes.sql in your database.'
      );
    }
    
    await ctx.reply(
      language === 'pt'
        ? `❌ Erro ao adicionar receita: ${error?.message || 'Erro desconhecido'}. Por favor, tente novamente.`
        : `❌ Error adding income: ${error?.message || 'Unknown error'}. Please try again.`
    );
  }
}

export async function handleListIncomes(ctx: Context) {
  try {
    const language = await getUserLanguage(ctx.from!.id.toString());
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply(t(language, 'messages.pleaseStart'));
    }

    const timezone = user.timezone || 'America/Sao_Paulo';
    const now = nowInTimezone(timezone);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const incomes = await getMonthlyIncomes(user.id, year, month, timezone);
    const total = await getTotalIncomesByMonth(user.id, year, month, timezone);
    const byCategory = await getIncomesByCategory(
      user.id,
      startOfMonth(now),
      endOfMonth(now)
    );

    if (incomes.length === 0) {
      return ctx.reply(language === 'pt' ? '📊 Nenhuma receita registrada neste mês.' : '📊 No incomes recorded for this month.');
    }

    let message = language === 'pt'
      ? `💰 Receitas - ${format(now, 'MMMM yyyy', { locale: require('date-fns/locale/pt-BR') })}\n\n`
      : `💰 Incomes - ${format(now, 'MMMM yyyy')}\n\n`;
    message += language === 'pt' ? `Total: R$ ${total.toFixed(2)}\n` : `Total: R$ ${total.toFixed(2)}\n`;
    message += language === 'pt' ? `Transações: ${incomes.length}\n\n` : `Transactions: ${incomes.length}\n\n`;
    message += language === 'pt' ? `Por Categoria:\n` : `By Category:\n`;

    for (const cat of byCategory) {
      const catTotal = typeof cat.total === 'number' ? cat.total : parseFloat(cat.total || '0');
      const totalNum = typeof total === 'number' ? total : parseFloat(total || '0');
      const percentage = totalNum > 0 ? (catTotal / totalNum) * 100 : 0;
      message += `  • ${cat.category}: R$ ${catTotal.toFixed(2)} (${percentage.toFixed(1)}%)\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error listing incomes:', error);
    const language = await getUserLanguage(ctx.from!.id.toString());
    await ctx.reply(language === 'pt' ? '❌ Erro ao listar receitas. Por favor, tente novamente.' : '❌ Error listing incomes. Please try again.');
  }
}

