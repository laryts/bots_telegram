import { Context } from 'telegraf';
import { getUserByTelegramId } from '../models/User';
import { createIncome, getMonthlyIncomes, getIncomesByCategory, getTotalIncomesByMonth } from '../models/Income';
import { categorizeExpense } from '../services/aiService';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export async function handleAddIncome(ctx: Context, amount: number, description: string) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    // Use AI to categorize (can reuse expense categorization logic)
    const category = await categorizeExpense(description);

    const income = await createIncome(user.id, amount, description, category);

    await ctx.reply(
      `✅ Income added!\n\n` +
      `💰 Amount: R$ ${amount.toFixed(2)}\n` +
      `📝 Description: ${description}\n` +
      `🏷️ Category: ${category}`
    );
  } catch (error) {
    console.error('Error adding income:', error);
    await ctx.reply('❌ Error adding income. Please try again.');
  }
}

export async function handleListIncomes(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const incomes = await getMonthlyIncomes(user.id, year, month);
    const total = await getTotalIncomesByMonth(user.id, year, month);
    const byCategory = await getIncomesByCategory(
      user.id,
      startOfMonth(now),
      endOfMonth(now)
    );

    if (incomes.length === 0) {
      return ctx.reply('📊 No incomes recorded for this month.');
    }

    let message = `💰 Incomes - ${format(now, 'MMMM yyyy')}\n\n`;
    message += `Total: R$ ${total.toFixed(2)}\n`;
    message += `Transactions: ${incomes.length}\n\n`;
    message += `By Category:\n`;

    for (const cat of byCategory) {
      const percentage = (cat.total / total) * 100;
      message += `  • ${cat.category}: R$ ${cat.total.toFixed(2)} (${percentage.toFixed(1)}%)\n`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('Error listing incomes:', error);
    await ctx.reply('❌ Error listing incomes. Please try again.');
  }
}

