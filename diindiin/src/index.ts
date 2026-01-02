import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';
import { handleStart, handleRefer, handleHelp } from './handlers/userHandlers';
import { handleAddExpense, handleMonthlyReport, handleCategories } from './handlers/expenseHandlers';
import { handleAddIncome, handleListIncomes } from './handlers/incomeHandlers';
import { handleReportCSV } from './handlers/reportHandlers';
import { handleListInvestments, handleAddInvestment, handleUpdateInvestmentValue } from './handlers/investmentHandlers';
import {
  handleAddObjective,
  handleAddKeyResult,
  handleAddAction,
  handleUpdateProgress,
  handleListOKRs,
  handleViewOKR,
} from './handlers/okrHandlers';
import {
  handleAddHabit,
  handleLogHabit,
  handleListHabits,
  handleHabitReview,
  handleHabitStats,
  handleHabitProgress,
  handleLinkHabitToAction,
} from './handlers/habitHandlers';
import {
  handleGenerateSpreadsheet,
  handleViewSpreadsheet,
  handleSyncSheets,
} from './handlers/spreadsheetHandlers';

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
    return ctx.reply('Usage: /add <amount> <description>\nExample: /add 50.00 Coffee at Starbucks\nExample: /add 50,00 Coffee (supports comma)');
  }

  // Parse amount - support both comma and dot as decimal separator
  let amountStr = args[0].replace(',', '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ Invalid amount. Please provide a valid number.\nExample: 50.00 or 50,00');
  }

  const description = args.slice(1).join(' ');
  await handleAddExpense(ctx, amount, description);
});

bot.command('report', handleMonthlyReport);
bot.command('reportcsv', handleReportCSV);
bot.command('categories', handleCategories);

// Income commands
bot.command('income', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply('Usage: /income <amount> <description>\nExample: /income 5000.00 Salary');
  }

  // Parse amount - support both comma and dot as decimal separator
  let amountStr = args[0].replace(',', '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ Invalid amount. Please provide a valid number.\nExample: 50.00 or 50,00');
  }

  const description = args.slice(1).join(' ');
  await handleAddIncome(ctx, amount, description);
});

bot.command('incomes', handleListIncomes);

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
  // Parse amount - support both comma and dot as decimal separator
  let amountStr = args[2].replace(',', '.');
  const amount = parseFloat(amountStr);
  const dateStr = args[3];

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ Invalid amount. Please provide a valid number.\nExample: 50.00 or 50,00');
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

// OKR commands
bot.command('okrs', handleListOKRs);

bot.command('addobjective', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 1) {
    return ctx.reply('Usage: /addobjective <title>\nExample: /addobjective "Ser uma grande gostosa"');
  }

  const title = args.join(' ');
  await handleAddObjective(ctx, title);
});

bot.command('addkr', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply('Usage: /addkr <objective_id> <title> [target]\nExample: /addkr 1 "Metas planilha" 42');
  }

  const objectiveId = parseInt(args[0]);
  if (isNaN(objectiveId) || objectiveId <= 0) {
    return ctx.reply('❌ Invalid objective ID.');
  }

  const title = args.slice(1, args.length - 1).join(' ');
  const target = args[args.length - 1];
  await handleAddKeyResult(ctx, objectiveId, title, target);
});

bot.command('addaction', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply('Usage: /addaction <kr_id> <description>\nExample: /addaction 1 "Treinar musculação 4x por semana"');
  }

  const keyResultId = parseInt(args[0]);
  if (isNaN(keyResultId) || keyResultId <= 0) {
    return ctx.reply('❌ Invalid key result ID.');
  }

  const description = args.slice(1).join(' ');
  await handleAddAction(ctx, keyResultId, description);
});

bot.command('updateprogress', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply('Usage: /updateprogress <action_id> <progress>\nExample: /updateprogress 1 "2/52"');
  }

  const actionId = parseInt(args[0]);
  if (isNaN(actionId) || actionId <= 0) {
    return ctx.reply('❌ Invalid action ID.');
  }

  const progress = args.slice(1).join(' ');
  await handleUpdateProgress(ctx, actionId, progress);
});

bot.command('okr', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 1) {
    return ctx.reply('Usage: /okr <objective_id>\nExample: /okr 1');
  }

  const objectiveId = parseInt(args[0]);
  if (isNaN(objectiveId) || objectiveId <= 0) {
    return ctx.reply('❌ Invalid objective ID.');
  }

  await handleViewOKR(ctx, objectiveId);
});

// Habit commands
bot.command('habits', handleListHabits);

bot.command('addhabit', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply('Usage: /addhabit <name> <frequency>\nExample: /addhabit "treino" "4x por semana"');
  }

  const name = args[0];
  const frequency = args.slice(1).join(' ');
  await handleAddHabit(ctx, name, frequency);
});

bot.command('habit', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 1) {
    return ctx.reply('Usage: /habit <name> [value] [date]\nExample: /habit treino\nExample: /habit agua 2L\nExample: /habit treino 2024-01-15');
  }

  if (args[0].toLowerCase() === 'review') {
    await handleHabitReview(ctx);
    return;
  }

  const name = args[0];
  let value: string | undefined;
  let dateStr: string | undefined;

  // Try to parse value and date
  if (args.length >= 2) {
    // Check if second arg is a date (YYYY-MM-DD format)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (datePattern.test(args[1])) {
      dateStr = args[1];
    } else {
      value = args[1];
      if (args.length >= 3 && datePattern.test(args[2])) {
        dateStr = args[2];
      }
    }
  }

  await handleLogHabit(ctx, name, value, dateStr);
});

bot.command('habitstats', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 1) {
    return ctx.reply('Usage: /habitstats <name>\nExample: /habitstats treino');
  }

  const name = args.join(' ');
  await handleHabitStats(ctx, name);
});

bot.command('habitprogress', handleHabitProgress);

bot.command('linkhabit', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply('Usage: /linkhabit <name> <action_id>\nExample: /linkhabit treino 1');
  }

  const habitName = args[0];
  const actionId = parseInt(args[1]);

  if (isNaN(actionId) || actionId <= 0) {
    return ctx.reply('❌ Invalid action ID.');
  }

  await handleLinkHabitToAction(ctx, habitName, actionId);
});

// Spreadsheet commands
bot.command('spreadsheet', handleGenerateSpreadsheet);
bot.command('viewspreadsheet', handleViewSpreadsheet);
bot.command('syncsheets', handleSyncSheets);

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

