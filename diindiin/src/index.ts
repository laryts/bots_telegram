import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';
import { handleStart, handleRefer, handleHelp } from './handlers/userHandlers';
import { handleAddExpense, handleMonthlyReport, handleCategories } from './handlers/expenseHandlers';
import { handleListInvestments, handleAddInvestment, handleUpdateInvestmentValue } from './handlers/investmentHandlers';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Start command
bot.command('start', async (ctx) => {
  const referralCode = ctx.message.text.split(' ')[1];
  await handleStart(ctx, referralCode);
});

// Help command
bot.command('help', handleHelp);

// Referral command
bot.command('refer', handleRefer);

// Expense commands
bot.command('add', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply('Usage: /add <amount> <description>\nExample: /add 50.00 Coffee at Starbucks');
  }

  const amount = parseFloat(args[0]);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ Invalid amount. Please provide a valid number.');
  }

  const description = args.slice(1).join(' ');
  await handleAddExpense(ctx, amount, description);
});

bot.command('report', handleMonthlyReport);
bot.command('categories', handleCategories);

// Investment commands
bot.command('investments', handleListInvestments);

bot.command('addinvestment', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 4) {
    return ctx.reply(
      'Usage: /addinvestment <name> <type> <amount> <date>\n' +
      'Example: /addinvestment "Bitcoin" "Crypto" 1000.00 2024-01-15'
    );
  }

  const name = args[0];
  const type = args[1];
  const amount = parseFloat(args[2]);
  const dateStr = args[3];

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ Invalid amount. Please provide a valid number.');
  }

  const purchaseDate = new Date(dateStr);
  if (isNaN(purchaseDate.getTime())) {
    return ctx.reply('❌ Invalid date format. Use YYYY-MM-DD');
  }

  const notes = args.slice(4).join(' ') || undefined;
  await handleAddInvestment(ctx, name, type, amount, purchaseDate, notes);
});

bot.command('updateinvestment', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply('Usage: /updateinvestment <id> <current_value>\nExample: /updateinvestment 1 1200.00');
  }

  const investmentId = parseInt(args[0]);
  const currentValue = parseFloat(args[1]);

  if (isNaN(investmentId) || investmentId <= 0) {
    return ctx.reply('❌ Invalid investment ID.');
  }

  if (isNaN(currentValue) || currentValue < 0) {
    return ctx.reply('❌ Invalid value. Please provide a valid number.');
  }

  await handleUpdateInvestmentValue(ctx, investmentId, currentValue);
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ An error occurred. Please try again.');
});

async function startBot() {
  try {
    await initDatabase();
    await bot.launch();
    console.log('Bot started successfully!');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

startBot();

