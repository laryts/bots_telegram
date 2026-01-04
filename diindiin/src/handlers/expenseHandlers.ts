import { Context } from 'telegraf';
import { getUserByTelegramId, getUserLanguage } from '../models/User';
import { createExpense, getMonthlyExpenses, getExpensesByCategory, getTotalExpensesByMonth } from '../models/Expense';
import { getTotalIncomesByMonth } from '../models/Income';
import { getMonthlyContributions, getTotalContributionsByMonth } from '../models/Investment';
import { categorizeExpense, generateFinancialInsight } from '../services/aiService';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { nowInTimezone } from '../utils/timezone';
import { t } from '../utils/i18n';

export async function handleAddExpense(ctx: Context, amount: number, description: string) {
  try {
    const language = await getUserLanguage(ctx.from!.id.toString());
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply(t(language, 'messages.pleaseStart'));
    }

    // Check for investment/transfer keywords first
    const lowerDescription = description.toLowerCase();
    const transferKeywords = [
      'investimento', 'investment', 'investir', 'invest',
      'transferencia', 'transferência', 'transfer', 'transf',
      'contribuicao', 'contribuição', 'contribution', 'contrib',
      'aplicacao', 'aplicação', 'aplicar', 'aplic'
    ];
    
    let category: string;
    if (transferKeywords.some(keyword => lowerDescription.includes(keyword))) {
      category = 'Transfer';
    } else {
      // Use AI to categorize
      category = await categorizeExpense(description);
    }

    const timezone = user.timezone || 'America/Sao_Paulo';
    const expense = await createExpense(user.id, amount, description, category, timezone);

    await ctx.reply(
      `${t(language, 'messages.expenseAdded')}\n\n` +
      `💰 ${t(language, 'messages.amount')}: R$ ${amount.toFixed(2)}\n` +
      `📝 ${t(language, 'messages.description')}: ${description}\n` +
      `🏷️ ${t(language, 'messages.category')}: ${category}`
    );
  } catch (error) {
    console.error('Error adding expense:', error);
    const language = await getUserLanguage(ctx.from!.id.toString());
    await ctx.reply(t(language, 'errors.addingExpense'));
  }
}

export async function handleMonthlyReport(ctx: Context) {
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

    let totalExpenses = 0;
    let totalIncomes = 0;
    let totalInvestments = 0;
    let expenses: any[] = [];
    let contributions: any[] = [];
    let byCategory: any[] = [];

    try {
      expenses = await getMonthlyExpenses(user.id, year, month, timezone);
      // Include all expenses in total (including transfers, as money left the account)
      totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(String(expense.amount || 0)), 0);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      // Continue even if expenses fail
    }

    try {
      totalIncomes = await getTotalIncomesByMonth(user.id, year, month, timezone);
    } catch (error) {
      console.error('Error fetching incomes:', error);
      // If incomes table doesn't exist, set to 0
      totalIncomes = 0;
    }

    try {
      contributions = await getMonthlyContributions(user.id, year, month, timezone);
      totalInvestments = await getTotalContributionsByMonth(user.id, year, month, timezone);
    } catch (error) {
      console.error('Error fetching investments:', error);
      // If investments table doesn't exist, set to 0
      totalInvestments = 0;
    }

    try {
      byCategory = await getExpensesByCategory(
        user.id,
        startOfMonth(now),
        endOfMonth(now)
      );
      // Double-check conversion (safety net in case model doesn't convert)
      byCategory = byCategory.map(cat => ({
        category: cat.category,
        total: typeof cat.total === 'number' ? cat.total : parseFloat(String(cat.total || '0')),
        count: typeof cat.count === 'number' ? cat.count : parseInt(String(cat.count || '0'), 10)
      }));
    } catch (error) {
      console.error('Error fetching categories:', error);
      byCategory = [];
    }

    if (expenses.length === 0 && totalIncomes === 0 && totalInvestments === 0) {
      return ctx.reply(language === 'pt' ? '📊 Nenhuma transação registrada neste mês.' : '📊 No transactions recorded for this month.');
    }

    let report = language === 'pt' 
      ? `📊 Relatório Mensal - ${format(now, 'MMMM yyyy', { locale: require('date-fns/locale/pt-BR') })}\n\n`
      : `📊 Monthly Report - ${format(now, 'MMMM yyyy')}\n\n`;
    
    if (totalIncomes > 0) {
      report += language === 'pt' 
        ? `💰 Receita: R$ ${totalIncomes.toFixed(2)}\n`
        : `💰 Income: R$ ${totalIncomes.toFixed(2)}\n`;
    }
    
    report += language === 'pt'
      ? `💸 Despesas: R$ ${totalExpenses.toFixed(2)}\n`
      : `💸 Expenses: R$ ${totalExpenses.toFixed(2)}\n`;
    
    const balance = totalIncomes - totalExpenses;
    report += language === 'pt'
      ? `📊 Saldo: R$ ${balance.toFixed(2)}\n`
      : `📊 Balance: R$ ${balance.toFixed(2)}\n`;
    
    if (expenses.length > 0) {
      report += language === 'pt'
        ? `\n📝 Transações de Despesas: ${expenses.length}\n`
        : `\n📝 Expense Transactions: ${expenses.length}\n`;
      
      if (byCategory.length > 0) {
        const transferCategories = ['Transferência', 'Transfer', 'transferência', 'transfer', 'Transferencia'];
        
        // Separate transfers from other categories
        const transferCategories_list: typeof byCategory = [];
        const otherCategories: typeof byCategory = [];
        
        for (const cat of byCategory) {
          const isTransfer = transferCategories.includes(cat.category);
          if (isTransfer) {
            transferCategories_list.push(cat);
          } else {
            otherCategories.push(cat);
          }
        }
        
        // Show other categories first
        if (otherCategories.length > 0) {
          report += language === 'pt' ? `📈 Por Categoria:\n` : `📈 By Category:\n`;
          for (const cat of otherCategories) {
            const catTotal = typeof cat.total === 'number' ? cat.total : parseFloat(String(cat.total || '0'));
            const percentage = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
            report += `  • ${cat.category}: R$ ${catTotal.toFixed(2)} (${percentage.toFixed(1)}%)\n`;
          }
        }
        
        // Show transfers separately
        if (transferCategories_list.length > 0) {
          report += language === 'pt' ? `\n💸 Transferências entre Contas:\n` : `\n💸 Account Transfers:\n`;
          for (const cat of transferCategories_list) {
            const catTotal = typeof cat.total === 'number' ? cat.total : parseFloat(String(cat.total || '0'));
            const percentage = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
            report += `  • ${cat.category}: R$ ${catTotal.toFixed(2)} (${percentage.toFixed(1)}%)\n`;
          }
        }
      }
    }

    if (contributions.length > 0) {
      report += language === 'pt'
        ? `\n📝 Contribuições de Investimentos: ${contributions.length}\n`
        : `\n📝 Investment Contributions: ${contributions.length}\n`;
      
      // Group by investment name
      const byInvestment: { [key: string]: number } = {};
      for (const contrib of contributions) {
        const key = `${contrib.investment_name} (${contrib.investment_type})`;
        byInvestment[key] = (byInvestment[key] || 0) + parseFloat(String(contrib.amount));
      }
      
      if (Object.keys(byInvestment).length > 0) {
        report += language === 'pt' ? `📈 Por Investimento:\n` : `📈 By Investment:\n`;
        for (const [investment, total] of Object.entries(byInvestment)) {
          const percentage = totalInvestments > 0 ? (total / totalInvestments) * 100 : 0;
          report += `  • ${investment}: R$ ${total.toFixed(2)} (${percentage.toFixed(1)}%)\n`;
        }
      }
    }

    // Generate AI insight
    if (byCategory.length > 0 && totalExpenses > 0) {
      try {
        const insight = await generateFinancialInsight(byCategory, totalExpenses);
        report += language === 'pt' ? `\n🤖 Insight de IA:\n${insight}` : `\n🤖 AI Insight:\n${insight}`;
      } catch (error) {
        console.error('Error generating AI insight:', error);
        // Continue without insight if AI fails
      }
    }

    await ctx.reply(report);
  } catch (error) {
    console.error('Error generating report:', error);
    const language = await getUserLanguage(ctx.from!.id.toString());
    await ctx.reply(
      language === 'pt'
        ? `❌ Erro ao gerar relatório: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Por favor, tente novamente.`
        : `❌ Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
    );
  }
}

export async function handleCategories(ctx: Context) {
  try {
    const language = await getUserLanguage(ctx.from!.id.toString());
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply(t(language, 'messages.pleaseStart'));
    }

    const timezone = user.timezone || 'America/Sao_Paulo';
    const now = nowInTimezone(timezone);
    const byCategory = await getExpensesByCategory(
      user.id,
      startOfMonth(now),
      endOfMonth(now)
    );

    if (byCategory.length === 0) {
      return ctx.reply(language === 'pt' ? '📊 Nenhuma despesa registrada neste mês.' : '📊 No expenses recorded for this month.');
    }

    let message = language === 'pt'
      ? `🏷️ Despesas por Categoria (${format(now, 'MMMM yyyy', { locale: require('date-fns/locale/pt-BR') })}):\n\n`
      : `🏷️ Expenses by Category (${format(now, 'MMMM yyyy')}):\n\n`;
    
    for (const cat of byCategory) {
      const catTotal = typeof cat.total === 'number' ? cat.total : parseFloat(cat.total || '0');
      const catCount = typeof cat.count === 'number' ? cat.count : parseInt(cat.count || '0', 10);
      const transText = language === 'pt' ? 'transações' : 'transactions';
      message += `  • ${cat.category}: R$ ${catTotal.toFixed(2)} (${catCount} ${transText})\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error getting categories:', error);
    const language = await getUserLanguage(ctx.from!.id.toString());
    await ctx.reply(language === 'pt' ? '❌ Erro ao obter categorias. Por favor, tente novamente.' : '❌ Error getting categories. Please try again.');
  }
}

