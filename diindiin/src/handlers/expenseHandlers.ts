import { Context } from 'telegraf';
import { getUserByTelegramId } from '../models/User';
import { createExpense, getMonthlyExpenses, getExpensesByCategory, getTotalExpensesByMonth } from '../models/Expense';
import { getTotalIncomesByMonth } from '../models/Income';
import { categorizeExpense, generateFinancialInsight } from '../services/aiService';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export async function handleAddExpense(ctx: Context, amount: number, description: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    // Use AI to categorize
    const category = await categorizeExpense(description);

    const expense = await createExpense(user.id, amount, description, category);

    await ctx.reply(
      `✅ Expense added!\n\n` +
      `💰 Amount: R$ ${amount.toFixed(2)}\n` +
      `📝 Description: ${description}\n` +
      `🏷️ Category: ${category}`
    );
  } catch (error) {
    console.error('Error adding expense:', error);
    await ctx.reply('❌ Error adding expense. Please try again.');
  }
}

export async function handleMonthlyReport(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let totalExpenses = 0;
    let totalIncomes = 0;
    let expenses: any[] = [];
    let byCategory: any[] = [];

    try {
      expenses = await getMonthlyExpenses(user.id, year, month);
      totalExpenses = await getTotalExpensesByMonth(user.id, year, month);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      // Continue even if expenses fail
    }

    try {
      totalIncomes = await getTotalIncomesByMonth(user.id, year, month);
    } catch (error) {
      console.error('Error fetching incomes:', error);
      // If incomes table doesn't exist, set to 0
      totalIncomes = 0;
    }

    try {
      byCategory = await getExpensesByCategory(
        user.id,
        startOfMonth(now),
        endOfMonth(now)
      );
    } catch (error) {
      console.error('Error fetching categories:', error);
      byCategory = [];
    }

    if (expenses.length === 0 && totalIncomes === 0) {
      return ctx.reply('📊 No transactions recorded for this month.');
    }

    let report = `📊 Monthly Report - ${format(now, 'MMMM yyyy')}\n\n`;
    
    if (totalIncomes > 0) {
      report += `💰 Income: R$ ${totalIncomes.toFixed(2)}\n`;
    }
    
    report += `💸 Expenses: R$ ${totalExpenses.toFixed(2)}\n`;
    
    const balance = totalIncomes - totalExpenses;
    report += `📊 Balance: R$ ${balance.toFixed(2)}\n`;
    
    if (expenses.length > 0) {
      report += `\n📝 Expense Transactions: ${expenses.length}\n`;
      
      if (byCategory.length > 0) {
        report += `📈 By Category:\n`;

        for (const cat of byCategory) {
          const catTotal = typeof cat.total === 'number' ? cat.total : parseFloat(cat.total || '0');
          const percentage = totalExpenses > 0 ? (catTotal / totalExpenses) * 100 : 0;
          report += `  • ${cat.category}: R$ ${catTotal.toFixed(2)} (${percentage.toFixed(1)}%)\n`;
        }
      }
    }

    // Generate AI insight
    if (byCategory.length > 0 && totalExpenses > 0) {
      try {
        const insight = await generateFinancialInsight(byCategory, totalExpenses);
        report += `\n🤖 AI Insight:\n${insight}`;
      } catch (error) {
        console.error('Error generating AI insight:', error);
        // Continue without insight if AI fails
      }
    }

    await ctx.reply(report);
  } catch (error) {
    console.error('Error generating report:', error);
    await ctx.reply(`❌ Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
  }
}

export async function handleCategories(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const now = new Date();
    const byCategory = await getExpensesByCategory(
      user.id,
      startOfMonth(now),
      endOfMonth(now)
    );

    if (byCategory.length === 0) {
      return ctx.reply('📊 No expenses recorded for this month.');
    }

    let message = `🏷️ Expenses by Category (${format(now, 'MMMM yyyy')}):\n\n`;
    
    for (const cat of byCategory) {
      message += `  • ${cat.category}: R$ ${cat.total.toFixed(2)} (${cat.count} transactions)\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error getting categories:', error);
    await ctx.reply('❌ Error getting categories. Please try again.');
  }
}

