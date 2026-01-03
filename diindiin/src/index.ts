import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';
import { handleStart, handleRefer, handleHelp, handleLanguage } from './handlers/userHandlers';
import { handleAddExpense, handleMonthlyReport, handleCategories } from './handlers/expenseHandlers';
import { handleAddIncome, handleListIncomes } from './handlers/incomeHandlers';
import { findExpensesByDescription, deleteExpense } from './models/Expense';
import { findIncomesByDescription, deleteIncome } from './models/Income';
import { findInvestmentsByName, deleteInvestment } from './models/Investment';
import { format } from 'date-fns';
import { fromUTC } from './utils/timezone';
import { handleReportCSV } from './handlers/reportHandlers';
import { handleListInvestments, handleAddInvestment, handleUpdateInvestmentValue, handleListContributions } from './handlers/investmentHandlers';
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
import { getUserLanguage, getUserByTelegramId } from './models/User';
import { parseCommand, parseArgs as parseArgsUtil, EntityType } from './utils/commandParser';
import { t, Language } from './utils/i18n';

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

// Language command
bot.command('language', handleLanguage);
bot.command('idioma', handleLanguage);

// Unified add command - simplified syntax
bot.command('add', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const commandText = ctx.message.text.substring('/add'.length).trim();
  const parts = commandText.split(/\s+/);
  
  if (parts.length === 0) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /add <income|outcome|investment> <description> <amount>\n` +
      `${t(language, 'messages.examples')}:\n` +
      `  /add income salario 20000\n` +
      `  /add uber 50\n` +
      `  /add outcome uber 50\n` +
      `  /add investment "reserva" CDB 1000`
    );
  }
  
  // Check first argument for entity type
  const firstArg = parts[0].toLowerCase();
  let entityType: 'income' | 'expense' | 'investment' | null = null;
  let args: string[] = [];
  
  if (firstArg === 'income') {
    entityType = 'income';
    args = parts.slice(1);
  } else if (firstArg === 'outcome' || firstArg === 'expense') {
    entityType = 'expense';
    args = parts.slice(1);
  } else if (firstArg === 'investment') {
    entityType = 'investment';
    args = parts.slice(1);
  } else {
    // If first arg is a number, it's an expense (backward compatibility)
    const firstArgAsNum = parseFloat(firstArg.replace(',', '.'));
    if (!isNaN(firstArgAsNum) && firstArgAsNum > 0) {
      entityType = 'expense';
      args = parts; // Use all parts including the number
    } else {
      // Default to expense if no type specified
      entityType = 'expense';
      args = parts;
    }
  }
  
  // Handle income
  if (entityType === 'income') {
    if (args.length < 2) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /add income <description> <amount>\n` +
        `${t(language, 'messages.example')}: /add income salario 20000`
      );
    }
    // Last arg should be amount, rest is description
    const amountStr = args[args.length - 1].replace(',', '.');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(`${t(language, 'messages.invalidAmount')}\n${t(language, 'messages.example')}: 50.00 or 50,00`);
    }
    const description = args.slice(0, -1).join(' ');
    await handleAddIncome(ctx, amount, description);
    return;
  }
  
  // Handle expense
  if (entityType === 'expense') {
    if (args.length < 2) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /add <description> <amount> or /add outcome <description> <amount>\n` +
        `${t(language, 'messages.example')}: /add uber 50`
      );
    }
    // Last arg should be amount, rest is description
    const amountStr = args[args.length - 1].replace(',', '.');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(`${t(language, 'messages.invalidAmount')}\n${t(language, 'messages.example')}: 50.00 or 50,00`);
    }
    const description = args.slice(0, -1).join(' ');
    await handleAddExpense(ctx, amount, description);
    return;
  }
  
  // Handle investment
  if (entityType === 'investment') {
    // Route to investment handler (will be handled by existing /addinvestment logic)
    const investmentArgs = parseArgsUtil(commandText);
    if (investmentArgs.length < 3) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /add ${t(language, 'entities.investment')} <name> <type> <${t(language, 'messages.amount')}> [current_value] [date]\n` +
        `${t(language, 'messages.examples')}:\n` +
        `  /add ${t(language, 'entities.investment')} "reserva de emergencia" CDB 84203.72\n` +
        `  /add ${t(language, 'entities.investment')} "Tesouro Direto" RendaFixa 1000 13200`
      );
    }
    
    // Reuse investment parsing logic
    let amount: number | null = null;
    let amountIndex = -1;
    let currentValue: number | undefined = undefined;
    let dateStr: string | null = null;
    let dateIndex = -1;
    
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    for (let i = investmentArgs.length - 1; i >= 0; i--) {
      if (datePattern.test(investmentArgs[i])) {
        dateStr = investmentArgs[i];
        dateIndex = i;
        break;
      }
    }
    
    const maxCheckIndex = dateIndex >= 0 ? dateIndex : investmentArgs.length;
    const numbers: Array<{ value: number; index: number }> = [];
    
    for (let i = maxCheckIndex - 1; i >= 0; i--) {
      const cleaned = investmentArgs[i].replace(',', '.');
      const numOnly = cleaned.replace(/[^\d.]/g, '');
      const parsed = parseFloat(numOnly);
      const numFormat = /^\d+([.,]\d+)?$/;
      const cleanArg = investmentArgs[i].replace(/[^\d.,]/g, '');
      
      if (!isNaN(parsed) && parsed > 0 && numFormat.test(cleanArg)) {
        numbers.push({ value: parsed, index: i });
      }
    }
    
    if (numbers.length === 0) {
      return ctx.reply(`${t(language, 'messages.invalidAmount')}\n${t(language, 'messages.example')}: 50.00 or 50,00`);
    }
    
    amount = numbers[0].value;
    amountIndex = numbers[0].index;
    
    if (numbers.length >= 2) {
      currentValue = numbers[1].value;
    }
    
    const nameTypeArgs = investmentArgs.slice(0, amountIndex);
    
    if (nameTypeArgs.length < 2) {
      return ctx.reply(`❌ ${t(language, 'messages.usage')}: /add ${t(language, 'entities.investment')} <name> <type> <${t(language, 'messages.amount')}>`);
    }
    
    const type = nameTypeArgs[nameTypeArgs.length - 1];
    const name = nameTypeArgs.slice(0, -1).join(' ');
    const notes = dateIndex > amountIndex ? investmentArgs.slice(dateIndex + 1).join(' ') : undefined;
    
    const purchaseDate = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(purchaseDate.getTime())) {
      return ctx.reply(t(language, 'messages.invalidDate'));
    }
    
    await handleAddInvestment(ctx, name, type, amount, purchaseDate, currentValue, notes);
    return;
  }
  
});

// Portuguese alias for add - reuse the same logic
bot.command('adicionar', async (ctx) => {
  const language = await getUserLanguage(ctx.from!.id.toString());
  const commandText = ctx.message.text.substring('/adicionar'.length).trim();
  const parsed = parseCommand(commandText, language);
  
  // If entity type detected, route to appropriate handler
  if (parsed.entityType === 'income') {
    if (parsed.args.length < 2) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /adicionar ${t(language, 'entities.income')} <${t(language, 'messages.amount')}> <${t(language, 'messages.description')}>\n` +
        `${t(language, 'messages.example')}: /adicionar ${t(language, 'entities.income')} 5000.00 ${t(language, 'messages.description')}`
      );
    }
    const amountStr = parsed.args[0].replace(',', '.');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(`${t(language, 'messages.invalidAmount')}\n${t(language, 'messages.example')}: 50.00 or 50,00`);
    }
    const description = parsed.args.slice(1).join(' ');
    await handleAddIncome(ctx, amount, description);
    return;
  }
  
  if (parsed.entityType === 'investment') {
    const args = parseArgsUtil(commandText);
    if (args.length < 3) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /adicionar ${t(language, 'entities.investment')} <name> <type> <${t(language, 'messages.amount')}> [current_value] [date]\n` +
        `${t(language, 'messages.examples')}:\n` +
        `  /adicionar ${t(language, 'entities.investment')} "reserva de emergencia" CDB 84203.72\n` +
        `  /adicionar ${t(language, 'entities.investment')} "Tesouro Direto" RendaFixa 1000 13200`
      );
    }
    
    // Reuse investment parsing logic (same as /add investment)
    let amount: number | null = null;
    let amountIndex = -1;
    let currentValue: number | undefined = undefined;
    let dateStr: string | null = null;
    let dateIndex = -1;
    
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    for (let i = args.length - 1; i >= 0; i--) {
      if (datePattern.test(args[i])) {
        dateStr = args[i];
        dateIndex = i;
        break;
      }
    }
    
    const maxCheckIndex = dateIndex >= 0 ? dateIndex : args.length;
    const numbers: Array<{ value: number; index: number }> = [];
    
    for (let i = maxCheckIndex - 1; i >= 0; i--) {
      const cleaned = args[i].replace(',', '.');
      const numOnly = cleaned.replace(/[^\d.]/g, '');
      const parsed = parseFloat(numOnly);
      const numFormat = /^\d+([.,]\d+)?$/;
      const cleanArg = args[i].replace(/[^\d.,]/g, '');
      
      if (!isNaN(parsed) && parsed > 0 && numFormat.test(cleanArg)) {
        numbers.push({ value: parsed, index: i });
      }
    }
    
    if (numbers.length === 0) {
      return ctx.reply(`${t(language, 'messages.invalidAmount')}\n${t(language, 'messages.example')}: 50.00 or 50,00`);
    }
    
    amount = numbers[0].value;
    amountIndex = numbers[0].index;
    
    if (numbers.length >= 2) {
      currentValue = numbers[1].value;
    }
    
    const nameTypeArgs = args.slice(0, amountIndex);
    
    if (nameTypeArgs.length < 2) {
      return ctx.reply(`❌ ${t(language, 'messages.usage')}: /adicionar ${t(language, 'entities.investment')} <name> <type> <${t(language, 'messages.amount')}>`);
    }
    
    const type = nameTypeArgs[nameTypeArgs.length - 1];
    const name = nameTypeArgs.slice(0, -1).join(' ');
    const notes = dateIndex > amountIndex ? args.slice(dateIndex + 1).join(' ') : undefined;
    
    const purchaseDate = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(purchaseDate.getTime())) {
      return ctx.reply(t(language, 'messages.invalidDate'));
    }
    
    await handleAddInvestment(ctx, name, type, amount, purchaseDate, currentValue, notes);
    return;
  }
  
  // Default: treat as expense
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /adicionar <${t(language, 'messages.amount')}> <${t(language, 'messages.description')}>\n` +
      `${t(language, 'messages.example')}: /adicionar 50.00 Café\n` +
      `${t(language, 'messages.example')}: /adicionar 50,00 Café (suporta vírgula)`
    );
  }

  let amountStr = args[0].replace(',', '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply(`${t(language, 'messages.invalidAmount')}\n${t(language, 'messages.example')}: 50.00 or 50,00`);
  }

  const description = args.slice(1).join(' ');
  await handleAddExpense(ctx, amount, description);
});

bot.command('report', handleMonthlyReport);
bot.command('reportcsv', handleReportCSV);
bot.command('categories', handleCategories);

// Income commands
bot.command('income', async (ctx) => {
  const language = await getUserLanguage(ctx.from!.id.toString());
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 2) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /income <${t(language, 'messages.amount')}> <${t(language, 'messages.description')}>\n` +
      `${t(language, 'messages.example')}: /income 5000.00 ${language === 'pt' ? 'Salário' : 'Salary'}`
    );
  }

  // Parse amount - support both comma and dot as decimal separator
  let amountStr = args[0].replace(',', '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply(`${t(language, 'messages.invalidAmount')}\n${t(language, 'messages.example')}: 50.00 or 50,00`);
  }

  const description = args.slice(1).join(' ');
  await handleAddIncome(ctx, amount, description);
});

bot.command('incomes', handleListIncomes);

// Unified list command (multilingual)
bot.command('list', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const commandText = ctx.message.text.substring('/list'.length).trim().toLowerCase();
  
  if (commandText === 'income' || commandText === 'incomes') {
    await handleListIncomes(ctx);
    return;
  }
  
  if (commandText === 'outcome' || commandText === 'outcomes' || commandText === 'expense' || commandText === 'expenses') {
    // List expenses - we can reuse categories or create a simple list
    await handleCategories(ctx);
    return;
  }
  
  if (commandText === 'investment' || commandText === 'investments') {
    await handleListInvestments(ctx);
    return;
  }
  
  if (commandText === 'habit' || commandText === 'habits') {
    await handleListHabits(ctx);
    return;
  }
  
  if (commandText === 'objective' || commandText === 'objectives' || commandText === 'okr' || commandText === 'okrs') {
    await handleListOKRs(ctx);
    return;
  }
  
  // Default: show help or list all
  await ctx.reply(
    `${t(language, 'messages.usage')}: /list <income|outcome|investment|habit>\n` +
    `${t(language, 'messages.examples')}:\n` +
    `  /list income\n` +
    `  /list outcome\n` +
    `  /list investments`
  );
});

// Portuguese alias for list - reuse the same logic
bot.command('listar', async (ctx) => {
  const language = await getUserLanguage(ctx.from!.id.toString());
  const commandText = ctx.message.text.substring('/listar'.length).trim();
  const parsed = parseCommand(commandText, language);
  
  if (parsed.entityType === 'income') {
    await handleListIncomes(ctx);
    return;
  }
  
  if (parsed.entityType === 'investment') {
    await handleListInvestments(ctx);
    return;
  }
  
  if (parsed.entityType === 'habit') {
    await handleListHabits(ctx);
    return;
  }
  
  if (parsed.entityType === 'objective') {
    await handleListOKRs(ctx);
    return;
  }
  
  // Default: show help or list all
  await ctx.reply(
    `${t(language, 'messages.usage')}: /listar <${t(language, 'entities.investment')}|${t(language, 'entities.income')}|${t(language, 'entities.habit')}|${t(language, 'entities.objective')}>\n` +
    `${t(language, 'messages.examples')}:\n` +
    `  /listar ${t(language, 'entities.investments')}\n` +
    `  /listar ${t(language, 'entities.incomes')}\n` +
    `  /listar ${t(language, 'entities.habits')}`
  );
});

// Show command (alias for list) - reuse the same logic
bot.command('show', async (ctx) => {
  const language = await getUserLanguage(ctx.from!.id.toString());
  const commandText = ctx.message.text.substring('/show'.length).trim();
  const parsed = parseCommand(commandText, language);
  
  if (parsed.entityType === 'income') {
    await handleListIncomes(ctx);
    return;
  }
  
  if (parsed.entityType === 'investment') {
    await handleListInvestments(ctx);
    return;
  }
  
  if (parsed.entityType === 'habit') {
    await handleListHabits(ctx);
    return;
  }
  
  if (parsed.entityType === 'objective') {
    await handleListOKRs(ctx);
    return;
  }
  
  await ctx.reply(
    `${t(language, 'messages.usage')}: /show <${t(language, 'entities.investment')}|${t(language, 'entities.income')}|${t(language, 'entities.habit')}|${t(language, 'entities.objective')}>\n` +
    `${t(language, 'messages.examples')}:\n` +
    `  /show ${t(language, 'entities.investments')}\n` +
    `  /show ${t(language, 'entities.incomes')}\n` +
    `  /show ${t(language, 'entities.habits')}`
  );
});

bot.command('mostrar', async (ctx) => {
  const language = await getUserLanguage(ctx.from!.id.toString());
  const commandText = ctx.message.text.substring('/mostrar'.length).trim();
  const parsed = parseCommand(commandText, language);
  
  if (parsed.entityType === 'income') {
    await handleListIncomes(ctx);
    return;
  }
  
  if (parsed.entityType === 'investment') {
    await handleListInvestments(ctx);
    return;
  }
  
  if (parsed.entityType === 'habit') {
    await handleListHabits(ctx);
    return;
  }
  
  if (parsed.entityType === 'objective') {
    await handleListOKRs(ctx);
    return;
  }
  
  await ctx.reply(
    `${t(language, 'messages.usage')}: /mostrar <${t(language, 'entities.investment')}|${t(language, 'entities.income')}|${t(language, 'entities.habit')}|${t(language, 'entities.objective')}>\n` +
    `${t(language, 'messages.examples')}:\n` +
    `  /mostrar ${t(language, 'entities.investments')}\n` +
    `  /mostrar ${t(language, 'entities.incomes')}\n` +
    `  /mostrar ${t(language, 'entities.habits')}`
  );
});

// View command - view specific items by description/name
bot.command('view', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const user = await getUserByTelegramId(ctx.from!.id.toString());
  
  if (!user) {
    return ctx.reply(t(language, 'messages.pleaseStart'));
  }
  
  const searchTerm = ctx.message.text.substring('/view'.length).trim();
  
  if (!searchTerm) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /view <description>\n` +
      `${t(language, 'messages.examples')}:\n` +
      `  /view uber\n` +
      `  /view salario\n` +
      `  /view cdb`
    );
  }
  
  // Search in expenses
  const expenses = await findExpensesByDescription(user.id, searchTerm, 5);
  // Search in incomes
  const incomes = await findIncomesByDescription(user.id, searchTerm, 5);
  // Search in investments
  const investments = await findInvestmentsByName(user.id, searchTerm, 5);
  
  if (expenses.length === 0 && incomes.length === 0 && investments.length === 0) {
    return ctx.reply(
      language === 'pt' 
        ? `❌ Nenhum resultado encontrado para "${searchTerm}"`
        : `❌ No results found for "${searchTerm}"`
    );
  }
  
  let message = language === 'pt' 
    ? `🔍 Resultados para "${searchTerm}":\n\n`
    : `🔍 Results for "${searchTerm}":\n\n`;
  
  if (expenses.length > 0) {
    message += language === 'pt' ? `💸 Despesas:\n` : `💸 Expenses:\n`;
    for (const expense of expenses) {
      const date = fromUTC(new Date(expense.date), user.timezone || 'America/Sao_Paulo');
      message += `  • R$ ${parseFloat(String(expense.amount)).toFixed(2)} - ${expense.description} (${format(date, 'dd/MM/yyyy')})\n`;
    }
    message += '\n';
  }
  
  if (incomes.length > 0) {
    message += language === 'pt' ? `💰 Receitas:\n` : `💰 Incomes:\n`;
    for (const income of incomes) {
      const date = fromUTC(new Date(income.date), user.timezone || 'America/Sao_Paulo');
      message += `  • R$ ${parseFloat(String(income.amount)).toFixed(2)} - ${income.description} (${format(date, 'dd/MM/yyyy')})\n`;
    }
    message += '\n';
  }
  
  if (investments.length > 0) {
    message += language === 'pt' ? `📈 Investimentos:\n` : `📈 Investments:\n`;
    for (const investment of investments) {
      const currentValue = investment.current_value ? ` (R$ ${parseFloat(String(investment.current_value)).toFixed(2)})` : '';
      message += `  • ${investment.name} - ${investment.type} - R$ ${parseFloat(String(investment.amount)).toFixed(2)}${currentValue}\n`;
    }
  }
  
  await ctx.reply(message);
});

// Delete command
bot.command('delete', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const user = await getUserByTelegramId(ctx.from!.id.toString());
  
  if (!user) {
    return ctx.reply(t(language, 'messages.pleaseStart'));
  }
  
  const args = ctx.message.text.substring('/delete'.length).trim().split(/\s+/);
  
  if (args.length === 0) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /delete <expense|income|investment> <id>\n` +
      `${t(language, 'messages.example')}: /delete expense 1`
    );
  }
  
  const entityType = args[0].toLowerCase();
  const id = parseInt(args[1]);
  
  if (isNaN(id) || id <= 0) {
    return ctx.reply(language === 'pt' ? '❌ ID inválido' : '❌ Invalid ID');
  }
  
  let deleted = false;
  
  if (entityType === 'expense' || entityType === 'outcome') {
    deleted = await deleteExpense(id, user.id);
  } else if (entityType === 'income') {
    deleted = await deleteIncome(id, user.id);
  } else if (entityType === 'investment') {
    deleted = await deleteInvestment(id, user.id);
  } else {
    return ctx.reply(
      language === 'pt'
        ? '❌ Tipo inválido. Use: expense, income ou investment'
        : '❌ Invalid type. Use: expense, income or investment'
    );
  }
  
  if (deleted) {
    await ctx.reply(
      language === 'pt' 
        ? `✅ ${entityType === 'expense' || entityType === 'outcome' ? 'Despesa' : entityType === 'income' ? 'Receita' : 'Investimento'} deletado(a) com sucesso!`
        : `✅ ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} deleted successfully!`
    );
  } else {
    await ctx.reply(
      language === 'pt'
        ? '❌ Item não encontrado ou você não tem permissão para deletá-lo'
        : '❌ Item not found or you do not have permission to delete it'
    );
  }
});

// Investment commands
bot.command('investments', handleListInvestments);

// Helper function to parse command arguments, handling quoted strings
// Using parseArgsUtil from commandParser instead, but keeping this for backward compatibility
function parseArgs(text: string): string[] {
  return parseArgsUtil(text);
}

bot.command('addinvestment', async (ctx) => {
  const text = ctx.message.text;
  const commandText = text.substring('/addinvestment'.length).trim();
  const args = parseArgs(commandText);
  
  if (args.length < 3) {
    return ctx.reply(
      'Usage: /addinvestment <name> <type> <amount> [current_value] [date]\n' +
      'Examples:\n' +
      '  /addinvestment "reserva de emergencia" CDB 84203.72\n' +
      '  /addinvestment "reserva de emergencia" CDB 84203,72\n' +
      '  /addinvestment "Tesouro Direto" RendaFixa 1000 13200\n' +
      '  /addinvestment Bitcoin Crypto 1000.00 2024-01-15\n' +
      'Note: current_value and date are optional. Use quotes for names with spaces.'
    );
  }

  // Find numbers (amount, current_value, date) from the end
  let amount: number | null = null;
  let amountIndex = -1;
  let currentValue: number | undefined = undefined;
  let currentValueIndex = -1;
  let dateStr: string | null = null;
  let dateIndex = -1;
  
  // Look for date pattern (YYYY-MM-DD) - check from the end
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  for (let i = args.length - 1; i >= 0; i--) {
    if (datePattern.test(args[i])) {
      dateStr = args[i];
      dateIndex = i;
      break;
    }
  }
  
  // Look for numbers (amount and optionally current_value) - check from the end before date
  const maxCheckIndex = dateIndex >= 0 ? dateIndex : args.length;
  const numbers: Array<{ value: number; index: number }> = [];
  
  for (let i = maxCheckIndex - 1; i >= 0; i--) {
    const cleaned = args[i].replace(',', '.');
    const numOnly = cleaned.replace(/[^\d.]/g, '');
    const parsed = parseFloat(numOnly);
    const numFormat = /^\d+([.,]\d+)?$/;
    const cleanArg = args[i].replace(/[^\d.,]/g, '');
    
    if (!isNaN(parsed) && parsed > 0 && numFormat.test(cleanArg)) {
      numbers.push({ value: parsed, index: i });
    }
  }
  
  if (numbers.length === 0) {
    return ctx.reply('❌ Invalid amount. Please provide a valid number.\nExample: 50.00 or 50,00');
  }
  
  // First number (closest to end) is amount, second (if exists) is current_value
  // Numbers are in reverse order (from end), so first is amount, second is current_value
  amount = numbers[0].value;
  amountIndex = numbers[0].index;
  
  if (numbers.length >= 2) {
    currentValue = numbers[1].value;
    currentValueIndex = numbers[1].index;
  }
  
  // Everything before the first number (which is the amount) is name and type
  const nameTypeArgs = args.slice(0, amountIndex);
  
  if (nameTypeArgs.length < 2) {
    if (nameTypeArgs.length === 1) {
      return ctx.reply('❌ Please provide both name and type for the investment.\nExample: /addinvestment "reserva de emergencia" CDB 84203,72');
    }
    return ctx.reply('❌ Please provide both name and type for the investment.');
  }
  
  // Last arg before numbers is type, everything before that is name
  const type = nameTypeArgs[nameTypeArgs.length - 1];
  const name = nameTypeArgs.slice(0, -1).join(' ');
  const notes = dateIndex > amountIndex ? args.slice(dateIndex + 1).join(' ') : undefined;
  
  // Use provided date or default to today
  const purchaseDate = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(purchaseDate.getTime())) {
    return ctx.reply('❌ Invalid date format. Use YYYY-MM-DD');
  }

  await handleAddInvestment(ctx, name, type, amount, purchaseDate, currentValue, notes);
});

// Unified update command - simplified syntax
bot.command('update', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const commandText = ctx.message.text.substring('/update'.length).trim();
  const parts = commandText.split(/\s+/);
  
  if (parts.length === 0) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /update <investment> <name> <type> <current_value>\n` +
      `${t(language, 'messages.example')}: /update investment "reserva" CDB 1200`
    );
  }
  
  // Check first argument for entity type
  const firstArg = parts[0].toLowerCase();
  
  if (firstArg === 'investment') {
    const args = parts.slice(1);
    
    if (args.length < 3) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /update investment <name> <type> <current_value>\n` +
        `${t(language, 'messages.example')}: /update investment "reserva" CDB 1200`
      );
    }

    // Last arg should be current_value
    const currentValueStr = args[args.length - 1].replace(',', '.');
    const currentValue = parseFloat(currentValueStr);

    if (isNaN(currentValue) || currentValue < 0) {
      return ctx.reply(t(language, 'messages.invalidValue'));
    }

    // Everything before the last arg is name and type
    const nameTypeArgs = args.slice(0, -1);
    
    if (nameTypeArgs.length < 2) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /update investment <name> <type> <current_value>\n` +
        `${t(language, 'messages.example')}: /update investment "reserva" CDB 1200`
      );
    }

    const type = nameTypeArgs[nameTypeArgs.length - 1];
    const name = nameTypeArgs.slice(0, -1).join(' ');

    await handleUpdateInvestmentValue(ctx, name, type, currentValue);
    return;
  }
  
  // Default: show usage
  await ctx.reply(
    `${t(language, 'messages.usage')}: /update investment <name> <type> <current_value>\n` +
    `${t(language, 'messages.example')}: /update investment "reserva" CDB 1200`
  );
});

// Portuguese alias for update - reuse the same logic
bot.command('atualizar', async (ctx) => {
  const language = await getUserLanguage(ctx.from!.id.toString());
  const commandText = ctx.message.text.substring('/atualizar'.length).trim();
  const parsed = parseCommand(commandText, language);
  
  if (parsed.entityType === 'investment') {
    const args = parseArgs(commandText);
    
    if (args.length < 3) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /atualizar ${t(language, 'entities.investment')} <name> <type> <current_value>\n` +
        `${t(language, 'messages.example')}: /atualizar ${t(language, 'entities.investment')} "Tesouro Direto" RendaFixa 13200.00`
      );
    }

    const currentValueStr = args[args.length - 1].replace(',', '.');
    const currentValue = parseFloat(currentValueStr);

    if (isNaN(currentValue) || currentValue < 0) {
      return ctx.reply(t(language, 'messages.invalidValue'));
    }

    const nameTypeArgs = args.slice(0, -1);
    
    if (nameTypeArgs.length < 2) {
      return ctx.reply(`❌ ${t(language, 'messages.usage')}: /atualizar ${t(language, 'entities.investment')} <name> <type> <current_value>`);
    }

    const type = nameTypeArgs[nameTypeArgs.length - 1];
    const name = nameTypeArgs.slice(0, -1).join(' ');

    await handleUpdateInvestmentValue(ctx, name, type, currentValue);
    return;
  }
  
  // Default: show usage
  await ctx.reply(
    `${t(language, 'messages.usage')}: /atualizar ${t(language, 'entities.investment')} <name> <type> <current_value>`
  );
});

bot.command('updateinvestment', async (ctx) => {
  const language = await getUserLanguage(ctx.from!.id.toString());
  const text = ctx.message.text;
  const commandText = text.substring('/updateinvestment'.length).trim();
  const args = parseArgs(commandText);
  
  if (args.length < 3) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /updateinvestment <name> <type> <current_value>\n` +
      `${t(language, 'messages.example')}: /updateinvestment "Tesouro Direto" RendaFixa 13200.00\n` +
      `Note: ${t(language, 'messages.usage')} quotes for names with spaces.`
    );
  }

  // Last arg should be current_value (number)
  const currentValueStr = args[args.length - 1].replace(',', '.');
  const currentValue = parseFloat(currentValueStr);

  if (isNaN(currentValue) || currentValue < 0) {
    return ctx.reply(t(language, 'messages.invalidValue'));
  }

  // Everything before the last arg is name and type
  const nameTypeArgs = args.slice(0, -1);
  
  if (nameTypeArgs.length < 2) {
    return ctx.reply(`❌ ${t(language, 'messages.usage')}: /updateinvestment <name> <type> <current_value>`);
  }

  const type = nameTypeArgs[nameTypeArgs.length - 1];
  const name = nameTypeArgs.slice(0, -1).join(' ');

  await handleUpdateInvestmentValue(ctx, name, type, currentValue);
});

bot.command('contributions', async (ctx) => {
  const text = ctx.message.text;
  const commandText = text.substring('/contributions'.length).trim();
  const args = parseArgs(commandText);
  
  if (args.length < 2) {
    return ctx.reply(
      'Usage: /contributions <name> <type>\n' +
      'Example: /contributions "Tesouro Direto" RendaFixa\n' +
      'Note: Use quotes for names with spaces.'
    );
  }

  const type = args[args.length - 1];
  const name = args.slice(0, -1).join(' ');

  await handleListContributions(ctx, name, type);
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
bot.catch(async (err, ctx) => {
  console.error('Bot error:', err);
  const language = await getUserLanguage(ctx.from!.id.toString());
  ctx.reply(t(language, 'errors.generic'));
});

async function startBot() {
  try {
    await initDatabase();
    
    // Use webhooks in production (Railway), polling in development
    if (process.env.WEBHOOK_URL) {
      const port = process.env.PORT || 3000;
      await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/webhook`);
      console.log(`Bot webhook set to: ${process.env.WEBHOOK_URL}/webhook`);
      
      // Start Express server for webhooks
      const express = require('express');
      const app = express();
      app.use(express.json());
      
      app.post('/webhook', (req: any, res: any) => {
        bot.handleUpdate(req.body);
        res.sendStatus(200);
      });
      
      app.listen(port, () => {
        console.log(`Webhook server listening on port ${port}`);
      });
    } else {
      // Use polling in development
      // Drop pending updates to avoid conflicts
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.launch({
        dropPendingUpdates: true,
      });
      console.log('Bot started successfully with polling!');
    }
  } catch (error: any) {
    console.error('Failed to start bot:', error);
    
    // If it's a 409 conflict, it means another instance is running
    if (error.response?.error_code === 409) {
      console.error('⚠️  Another bot instance is running!');
      console.error('Solutions:');
      console.error('1. Stop local bot if running: Ctrl+C');
      console.error('2. Check Railway - only one deployment should be active');
      console.error('3. Use webhooks in production (set WEBHOOK_URL env var)');
      // Don't exit, try to continue (might be temporary)
      setTimeout(() => {
        console.log('Retrying bot start...');
        startBot();
      }, 5000);
      return;
    }
    
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

startBot();

