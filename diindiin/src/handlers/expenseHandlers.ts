import { Context } from 'telegraf';
import { getUserByTelegramId } from '../models/User';
import { createExpense, getMonthlyExpenses, getExpensesByCategory, getTotalExpensesByMonth } from '../models/Expense';
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

    const expenses = await getMonthlyExpenses(user.id, year, month);
    const total = await getTotalExpensesByMonth(user.id, year, month);
    const byCategory = await getExpensesByCategory(
      user.id,
      startOfMonth(now),
      endOfMonth(now)
    );

    if (expenses.length === 0) {
      return ctx.reply('📊 No expenses recorded for this month.');
    }

    let report = `📊 Monthly Report - ${format(now, 'MMMM yyyy')}\n\n`;
    report += `💰 Total: R$ ${total.toFixed(2)}\n`;
    report += `📝 Transactions: ${expenses.length}\n\n`;
    report += `📈 By Category:\n`;

    for (const cat of byCategory) {
      const percentage = (cat.total / total) * 100;
      report += `  • ${cat.category}: R$ ${cat.total.toFixed(2)} (${percentage.toFixed(1)}%)\n`;
    }

    // Generate AI insight
    const insight = await generateFinancialInsight(byCategory, total);
    report += `\n🤖 AI Insight:\n${insight}`;

    await ctx.reply(report);
  } catch (error) {
    console.error('Error generating report:', error);
    await ctx.reply('❌ Error generating report. Please try again.');
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

