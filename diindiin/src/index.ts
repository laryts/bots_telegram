import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';
import { handleStart, handleRefer, handleHelp, handleLanguage } from './handlers/userHandlers';
import { handleAddExpense, handleMonthlyReport, handleCategories } from './handlers/expenseHandlers';
import { handleAddIncome, handleListIncomes } from './handlers/incomeHandlers';
import { findExpensesByDescription, deleteExpense, getExpenseById, updateExpense, getExpensesByUser } from './models/Expense';
import { findIncomesByDescription, deleteIncome, getIncomeById, updateIncome, getIncomesByUser } from './models/Income';
import { findInvestmentsByName, deleteInvestment, getInvestmentById, updateInvestmentValueByNameAndType, getInvestmentsByUser, getContributionById, updateContribution, deleteContribution, getContributionsByInvestment, findInvestmentByNameAndType, createInvestmentContribution } from './models/Investment';
import { findHabitByName, getHabitLogs, getHabitById, updateHabit, getHabitsByUser, linkHabitToAction, getHabitStats } from './models/Habit';
import { getObjectivesByUser, getObjectiveById, updateObjective, getKeyResultById, updateKeyResult, getActionById, updateAction, findKeyResultByTitle, findActionByDescription, createKeyResult, createAction } from './models/OKR';
import { format } from 'date-fns';
import { fromUTC, nowInTimezone } from './utils/timezone';
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
import { parseOKRFromText, generateAIInsight } from './services/aiService';
import { createObjective } from './models/OKR';
import { createHabit } from './models/Habit';
import { getKeyResultsByObjective, getActionsByKeyResult } from './models/OKR';
import { getAllHabitsYearlyReview } from './models/Habit';
import { getTotalExpensesByMonth, getExpensesByCategory } from './models/Expense';
import { getTotalIncomesByMonth, getIncomesByCategory } from './models/Income';
import { getTotalInvestments } from './models/Investment';
import { startOfMonth, endOfMonth } from 'date-fns';

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
  const user = await getUserByTelegramId(ctx.from!.id.toString());
  
  if (!user) {
    return ctx.reply(t(language, 'messages.pleaseStart'));
  }
  
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
  let entityType: 'income' | 'expense' | 'investment' | 'habit' | 'okr' | 'kr' | 'action' | 'contribution' | null = null;
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
  } else if (firstArg === 'habit' || firstArg === 'habits') {
    entityType = 'habit';
    args = parts.slice(1);
  } else if (firstArg === 'okr' || firstArg === 'okrs' || firstArg === 'objective' || firstArg === 'objectives') {
    entityType = 'okr';
    args = parts.slice(1);
  } else if (firstArg === 'kr' || firstArg === 'keyresult') {
    entityType = 'kr';
    args = parts.slice(1);
  } else if (firstArg === 'action') {
    entityType = 'action';
    args = parts.slice(1);
  } else if (firstArg === 'contribution') {
    entityType = 'contribution';
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
  
  // Handle habit
  if (entityType === 'habit') {
    if (args.length < 2) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /add habit <name> <frequency>\n` +
        `${t(language, 'messages.example')}: /add habit treino "4x por semana"`
      );
    }
    const name = args[0];
    const frequency = args.slice(1).join(' ');
    await handleAddHabit(ctx, name, frequency);
    return;
  }
  
  // Handle OKR (objective)
  if (entityType === 'okr') {
    if (args.length < 1) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /add okr <title>\n` +
        `${t(language, 'messages.example')}: /add okr "Ser uma grande gostosa"`
      );
    }
    const title = args.join(' ');
    await handleAddObjective(ctx, title);
    return;
  }
  
  // Handle Key Result (kr)
  if (entityType === 'kr') {
  if (args.length < 3) {
    return ctx.reply(
        `${t(language, 'messages.usage')}: /add kr <okr_id|okr_title> <title> [target]\n` +
        `${t(language, 'messages.examples')}:\n` +
        `  /add kr "ser uma grande gostosa" peso 75\n` +
        `  /add kr 1 peso 75`
      );
    }
    
    // Try to parse first arg as ID, if not, search by OKR title
    let objectiveId: number | null = null;
    const firstArg = args[0];
    const parsedId = parseInt(firstArg);
    
    if (!isNaN(parsedId) && parsedId > 0) {
      // It's an ID
      objectiveId = parsedId;
    } else {
      // Search by OKR title
      const objectives = await getObjectivesByUser(user.id);
      const matching = objectives.filter(obj => 
        obj.title.toLowerCase().includes(firstArg.toLowerCase())
      );
      
      if (matching.length === 0) {
        return ctx.reply(
          language === 'pt'
            ? `❌ OKR "${firstArg}" não encontrado. Use /list okr para ver os IDs.`
            : `❌ OKR "${firstArg}" not found. Use /list okr to see IDs.`
        );
      }
      
      // Use the most recent one if multiple matches
      objectiveId = matching[0].id;
    }
    
    const title = args.slice(1, -1).join(' ');
    const target = args[args.length - 1];
    await handleAddKeyResult(ctx, objectiveId, title, target);
    return;
  }
  
  // Handle Action
  if (entityType === 'action') {
    if (args.length < 2) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /add action <kr_id|kr_title> <description>\n` +
        `${t(language, 'messages.examples')}:\n` +
        `  /add action "peso" "ir 250x academia"\n` +
        `  /add action 1 "Treinar musculação 4x por semana"`
      );
    }
    
    // Try to parse first arg as ID, if not, search by KR title
    let keyResultId: number | null = null;
    const firstArg = args[0];
    const parsedId = parseInt(firstArg);
    
    if (!isNaN(parsedId) && parsedId > 0) {
      // It's an ID
      keyResultId = parsedId;
    } else {
      // Search by KR title
      const keyResult = await findKeyResultByTitle(user.id, firstArg);
      
      if (!keyResult) {
    return ctx.reply(
          language === 'pt'
            ? `❌ Key Result "${firstArg}" não encontrado. Use /list okr para ver os KRs.`
            : `❌ Key Result "${firstArg}" not found. Use /list okr to see KRs.`
        );
      }
      
      keyResultId = keyResult.id;
    }
    
    const description = args.slice(1).join(' ');
    await handleAddAction(ctx, keyResultId, description);
    return;
  }
  
  // Handle Contribution
  if (entityType === 'contribution') {
    if (args.length < 3) {
      return ctx.reply(
        `${t(language, 'messages.usage')}: /add contribution <investment_name> <investment_type> <amount> [date]\n` +
        `${t(language, 'messages.example')}: /add contribution "reserva" CDB 1000`
      );
    }
    const investmentName = args[0];
    const investmentType = args[1];
    const amountStr = args[2].replace(',', '.');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(`${t(language, 'messages.invalidAmount')}\n${t(language, 'messages.example')}: 50.00 or 50,00`);
    }
    const dateStr = args[3];
    let contributionDate = new Date();
    if (dateStr) {
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        contributionDate = parsedDate;
      } else {
        return ctx.reply(t(language, 'messages.invalidDate'));
      }
    }
    
    // Find investment by name and type
    const investment = await findInvestmentByNameAndType(user.id, investmentName, investmentType);
    if (!investment) {
      return ctx.reply(
        language === 'pt'
          ? `❌ Investimento "${investmentName}" (${investmentType}) não encontrado`
          : `❌ Investment "${investmentName}" (${investmentType}) not found`
      );
    }
    
    await createInvestmentContribution(investment.id, amount, contributionDate);
    await ctx.reply(
      language === 'pt'
        ? `✅ Contribuição adicionada ao investimento "${investmentName}"!`
        : `✅ Contribution added to investment "${investmentName}"!`
    );
    return;
  }
  
});

// Report and categories commands
bot.command('report', handleMonthlyReport);
bot.command('reportcsv', handleReportCSV);
bot.command('categories', handleCategories);

// Unified edit command - simplified syntax (replaces /update)
bot.command('edit', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const user = await getUserByTelegramId(ctx.from!.id.toString());
  
  if (!user) {
    return ctx.reply(t(language, 'messages.pleaseStart'));
  }
  
  const commandText = ctx.message.text.substring('/edit'.length).trim();
  const parts = commandText.split(/\s+/);
  
  if (parts.length < 2) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /edit <entity> <id> [field=value]...\n` +
      `${t(language, 'messages.examples')}:\n` +
      `  /edit expense 1 amount=100\n` +
      `  /edit income 2 description="Novo salario"\n` +
      `  /edit investment 3 current_value=1200`
    );
  }
  
  const entityType = parts[0].toLowerCase();
  const id = parseInt(parts[1]);
  
  if (isNaN(id) || id <= 0) {
    return ctx.reply(language === 'pt' ? '❌ ID inválido' : '❌ Invalid ID');
  }
  
  // Parse field=value pairs
  const updates: Record<string, any> = {};
  for (let i = 2; i < parts.length; i++) {
    const part = parts[i];
    const match = part.match(/^(\w+)=(.+)$/);
    if (match) {
      const [, field, value] = match;
      updates[field] = value.replace(/^["']|["']$/g, ''); // Remove quotes
    }
  }
  
  if (Object.keys(updates).length === 0) {
    return ctx.reply(language === 'pt' ? '❌ Nenhum campo para atualizar' : '❌ No fields to update');
  }
  
  // Handle different entity types
  if (entityType === 'expense' || entityType === 'outcome') {
    const expense = await getExpenseById(id, user.id);
    if (!expense) {
      return ctx.reply(language === 'pt' ? '❌ Despesa não encontrada' : '❌ Expense not found');
    }
    
    const amount = updates.amount ? parseFloat(updates.amount.replace(',', '.')) : undefined;
    const updated = await updateExpense(id, user.id, amount, updates.description, updates.category);
    
    if (updated) {
      await ctx.reply(language === 'pt' ? '✅ Despesa atualizada!' : '✅ Expense updated!');
    } else {
      await ctx.reply(language === 'pt' ? '❌ Erro ao atualizar' : '❌ Error updating');
    }
    return;
  }
  
  if (entityType === 'income') {
    const income = await getIncomeById(id, user.id);
    if (!income) {
      return ctx.reply(language === 'pt' ? '❌ Receita não encontrada' : '❌ Income not found');
    }
    
    const amount = updates.amount ? parseFloat(updates.amount.replace(',', '.')) : undefined;
    const updated = await updateIncome(id, user.id, amount, updates.description, updates.category);
    
    if (updated) {
      await ctx.reply(language === 'pt' ? '✅ Receita atualizada!' : '✅ Income updated!');
    } else {
      await ctx.reply(language === 'pt' ? '❌ Erro ao atualizar' : '❌ Error updating');
    }
    return;
  }
  
  if (entityType === 'investment') {
    // For investment, we need name and type to find it, or use ID
    const investment = await getInvestmentById(id, user.id);
    if (!investment) {
      return ctx.reply(language === 'pt' ? '❌ Investimento não encontrado' : '❌ Investment not found');
    }
    
    if (updates.current_value) {
      const currentValue = parseFloat(updates.current_value.replace(',', '.'));
      await updateInvestmentValueByNameAndType(user.id, investment.name, investment.type, currentValue);
      await ctx.reply(language === 'pt' ? '✅ Investimento atualizado!' : '✅ Investment updated!');
    } else {
      await ctx.reply(language === 'pt' ? '❌ Use current_value=... para atualizar' : '❌ Use current_value=... to update');
    }
    return;
  }
  
  if (entityType === 'habit') {
    const habit = await getHabitById(id, user.id);
    if (!habit) {
      return ctx.reply(language === 'pt' ? '❌ Hábito não encontrado' : '❌ Habit not found');
    }
    
    const frequencyValue = updates.frequency_value ? parseInt(updates.frequency_value) : undefined;
    const updated = await updateHabit(id, user.id, updates.name, updates.description, updates.frequency_type, frequencyValue, updates.unit);
    
    if (updated) {
      await ctx.reply(language === 'pt' ? '✅ Hábito atualizado!' : '✅ Habit updated!');
    } else {
      await ctx.reply(language === 'pt' ? '❌ Erro ao atualizar' : '❌ Error updating');
    }
    return;
  }
  
  if (entityType === 'okr' || entityType === 'objective') {
    const objective = await getObjectiveById(id, user.id);
    if (!objective) {
      return ctx.reply(language === 'pt' ? '❌ OKR não encontrado' : '❌ OKR not found');
    }
    
    const targetDate = updates.target_date ? new Date(updates.target_date) : undefined;
    const updated = await updateObjective(id, user.id, updates.title, updates.description, targetDate);
    
    if (updated) {
      await ctx.reply(language === 'pt' ? '✅ OKR atualizado!' : '✅ OKR updated!');
    } else {
      await ctx.reply(language === 'pt' ? '❌ Erro ao atualizar' : '❌ Error updating');
    }
    return;
  }
  
  if (entityType === 'kr' || entityType === 'keyresult') {
    const keyResult = await getKeyResultById(id);
    if (!keyResult) {
      return ctx.reply(language === 'pt' ? '❌ Key Result não encontrado' : '❌ Key Result not found');
    }
    
    const targetValue = updates.target_value ? parseFloat(updates.target_value) : undefined;
    const currentValue = updates.current_value ? parseFloat(updates.current_value) : undefined;
    const updated = await updateKeyResult(id, updates.title, targetValue, currentValue, updates.unit);
    
    if (updated) {
      await ctx.reply(language === 'pt' ? '✅ Key Result atualizado!' : '✅ Key Result updated!');
    } else {
      await ctx.reply(language === 'pt' ? '❌ Erro ao atualizar' : '❌ Error updating');
    }
    return;
  }
  
  if (entityType === 'action') {
    const action = await getActionById(id);
    if (!action) {
      return ctx.reply(language === 'pt' ? '❌ Ação não encontrada' : '❌ Action not found');
    }
    
    const updated = await updateAction(id, updates.description, updates.status, updates.progress);
    
    if (updated) {
      await ctx.reply(language === 'pt' ? '✅ Ação atualizada!' : '✅ Action updated!');
    } else {
      await ctx.reply(language === 'pt' ? '❌ Erro ao atualizar' : '❌ Error updating');
    }
    return;
  }
  
  if (entityType === 'contribution') {
    const contribution = await getContributionById(id, user.id);
    if (!contribution) {
      return ctx.reply(language === 'pt' ? '❌ Contribuição não encontrada' : '❌ Contribution not found');
    }
    
    const amount = updates.amount ? parseFloat(updates.amount.replace(',', '.')) : undefined;
    const contributionDate = updates.date ? new Date(updates.date) : undefined;
    const updated = await updateContribution(id, user.id, amount, contributionDate, updates.notes);
    
    if (updated) {
      await ctx.reply(language === 'pt' ? '✅ Contribuição atualizada!' : '✅ Contribution updated!');
    } else {
      await ctx.reply(language === 'pt' ? '❌ Erro ao atualizar' : '❌ Error updating');
    }
    return;
  }
  
  await ctx.reply(
    language === 'pt'
      ? '❌ Tipo inválido. Use: expense, income, investment, habit, okr, kr, action, contribution'
      : '❌ Invalid type. Use: expense, income, investment, habit, okr, kr, action, contribution'
  );
});

// All old commands removed - only simplified commands remain

// Report and categories commands (kept as requested)
bot.command('report', handleMonthlyReport);
bot.command('reportcsv', handleReportCSV);
bot.command('categories', handleCategories);

// Unified list command - shows IDs
bot.command('list', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const user = await getUserByTelegramId(ctx.from!.id.toString());
  
  if (!user) {
    return ctx.reply(t(language, 'messages.pleaseStart'));
  }
  
  const commandText = ctx.message.text.substring('/list'.length).trim().toLowerCase();
  const timezone = user.timezone || 'America/Sao_Paulo';
  
  if (commandText === 'income' || commandText === 'incomes') {
    const incomes = await getIncomesByUser(user.id);
    if (incomes.length === 0) {
      return ctx.reply(language === 'pt' ? '📋 Nenhuma receita encontrada' : '📋 No incomes found');
    }
    
    let message = language === 'pt' ? '💰 Receitas:\n\n' : '💰 Incomes:\n\n';
    for (const income of incomes.slice(0, 50)) {
      const date = fromUTC(new Date(income.date), timezone);
      message += `ID: ${income.id} | R$ ${parseFloat(String(income.amount)).toFixed(2)} - ${income.description} (${format(date, 'dd/MM/yyyy')})\n`;
    }
    await ctx.reply(message);
    return;
  }
  
  if (commandText === 'outcome' || commandText === 'outcomes' || commandText === 'expense' || commandText === 'expenses') {
    const expenses = await getExpensesByUser(user.id);
    if (expenses.length === 0) {
      return ctx.reply(language === 'pt' ? '📋 Nenhuma despesa encontrada' : '📋 No expenses found');
    }
    
    let message = language === 'pt' ? '💸 Despesas:\n\n' : '💸 Expenses:\n\n';
    for (const expense of expenses.slice(0, 50)) {
      const date = fromUTC(new Date(expense.date), timezone);
      message += `ID: ${expense.id} | R$ ${parseFloat(String(expense.amount)).toFixed(2)} - ${expense.description} (${format(date, 'dd/MM/yyyy')})\n`;
    }
    await ctx.reply(message);
    return;
  }
  
  if (commandText === 'investment' || commandText === 'investments') {
    const investments = await getInvestmentsByUser(user.id);
    if (investments.length === 0) {
      return ctx.reply(language === 'pt' ? '📋 Nenhum investimento encontrado' : '📋 No investments found');
    }
    
    let message = language === 'pt' ? '📈 Investimentos:\n\n' : '📈 Investments:\n\n';
    for (const investment of investments.slice(0, 50)) {
      const currentValue = investment.current_value ? ` (R$ ${parseFloat(String(investment.current_value)).toFixed(2)})` : '';
      message += `ID: ${investment.id} | ${investment.name} - ${investment.type} - R$ ${parseFloat(String(investment.amount)).toFixed(2)}${currentValue}\n`;
    }
    await ctx.reply(message);
    return;
  }
  
  if (commandText === 'habit' || commandText === 'habits') {
    const habits = await getHabitsByUser(user.id);
    if (habits.length === 0) {
      return ctx.reply(language === 'pt' ? '📋 Nenhum hábito encontrado' : '📋 No habits found');
    }
    
    let message = language === 'pt' ? '🏋️ Hábitos:\n\n' : '🏋️ Habits:\n\n';
    for (const habit of habits.slice(0, 50)) {
      message += `ID: ${habit.id} | ${habit.name} - ${habit.frequency_type === 'daily' ? 'Diário' : `${habit.frequency_value || 'N/A'}x por semana`}\n`;
    }
    await ctx.reply(message);
    return;
  }
  
  if (commandText === 'objective' || commandText === 'objectives' || commandText === 'okr' || commandText === 'okrs') {
    const objectives = await getObjectivesByUser(user.id);
    if (objectives.length === 0) {
      return ctx.reply(language === 'pt' ? '📋 Nenhum OKR encontrado' : '📋 No OKRs found');
    }
    
    let message = language === 'pt' ? '🎯 OKRs:\n\n' : '🎯 OKRs:\n\n';
    for (const objective of objectives.slice(0, 50)) {
      message += `ID: ${objective.id} | ${objective.title}\n`;
    }
    await ctx.reply(message);
    return;
  }
  
  if (commandText.startsWith('contribution') || commandText.startsWith('contributions')) {
    // Need investment name and type from args
    const listParts = ctx.message.text.substring('/list'.length).trim().split(/\s+/);
    if (listParts.length < 3) {
      return ctx.reply(
        language === 'pt'
          ? '❌ Use: /list contributions <investment_name> <investment_type>'
          : '❌ Use: /list contributions <investment_name> <investment_type>'
      );
    }
    const investmentName = listParts[1];
    const investmentType = listParts[2];
    const contributions = await getContributionsByInvestment(user.id, investmentName, investmentType);
    if (contributions.length === 0) {
      return ctx.reply(language === 'pt' ? '📋 Nenhuma contribuição encontrada' : '📋 No contributions found');
    }
    
    let message = language === 'pt' ? '📈 Contribuições:\n\n' : '📈 Contributions:\n\n';
    for (const contribution of contributions.slice(0, 50)) {
      const date = fromUTC(new Date(contribution.contribution_date), timezone);
      message += `ID: ${contribution.id} | R$ ${parseFloat(String(contribution.amount)).toFixed(2)} - ${format(date, 'dd/MM/yyyy')}\n`;
    }
    await ctx.reply(message);
    return;
  }
  
  // Default: show help
  await ctx.reply(
    `${t(language, 'messages.usage')}: /list <income|outcome|investment|habit|okr>\n` +
    `${t(language, 'messages.examples')}:\n` +
    `  /list income\n` +
    `  /list outcome\n` +
    `  /list investments\n` +
    `  /list habit`
  );
});

// All old commands removed - only simplified commands remain

// View command - view specific items by description/name
bot.command('view', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const user = await getUserByTelegramId(ctx.from!.id.toString());
  
  if (!user) {
    return ctx.reply(t(language, 'messages.pleaseStart'));
  }
  
  const searchText = ctx.message.text.substring('/view'.length).trim();
  
  if (!searchText) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /view <description> or /view habit <name>\n` +
      `${t(language, 'messages.examples')}:\n` +
      `  /view uber\n` +
      `  /view salario\n` +
      `  /view cdb\n` +
      `  /view habit treino`
    );
  }
  
  // Check if it's a habit view: /view habit <name>
  const parts = searchText.split(/\s+/);
  if (parts.length >= 2 && parts[0].toLowerCase() === 'habit') {
    const habitName = parts.slice(1).join(' ');
    const habit = await findHabitByName(user.id, habitName);
    
    if (!habit) {
      return ctx.reply(
        language === 'pt'
          ? `❌ Hábito "${habitName}" não encontrado`
          : `❌ Habit "${habitName}" not found`
      );
    }
    
    // Get habit stats for current year
    const timezone = user.timezone || 'America/Sao_Paulo';
    const now = nowInTimezone(timezone);
    const currentYear = now.getFullYear();
    const stats = await getHabitStats(habit.id, currentYear, timezone);
    
    // Get recent logs
    const recentLogs = await getHabitLogs(habit.id, undefined, undefined);
    
    let message = language === 'pt'
      ? `🏋️ Hábito: ${habit.name} (ID: ${habit.id})\n\n`
      : `🏋️ Habit: ${habit.name} (ID: ${habit.id})\n\n`;
    
    message += language === 'pt'
      ? `📅 Frequência: ${habit.frequency_type === 'daily' ? 'Diário' : `${habit.frequency_value || 'N/A'}x por semana`}\n`
      : `📅 Frequency: ${habit.frequency_type === 'daily' ? 'Daily' : `${habit.frequency_value || 'N/A'}x per week`}\n`;
    
    if (stats.completedDays > 0) {
      message += language === 'pt'
        ? `📊 Dias completados este ano: ${stats.completedDays}\n`
        : `📊 Days completed this year: ${stats.completedDays}\n`;
      
      message += language === 'pt'
        ? `📈 Porcentagem: ${stats.percentage.toFixed(1)}%\n`
        : `📈 Percentage: ${stats.percentage.toFixed(1)}%\n`;
      
      if (stats.streak > 0) {
        message += language === 'pt'
          ? `🔥 Sequência atual: ${stats.streak} dias\n`
          : `🔥 Current streak: ${stats.streak} days\n`;
      }
      
      if (recentLogs.length > 0) {
        const lastLog = recentLogs[0];
        const lastDate = fromUTC(new Date(lastLog.date), timezone);
        message += language === 'pt'
          ? `📅 Último registro: ${format(lastDate, 'dd/MM/yyyy')}\n`
          : `📅 Last log: ${format(lastDate, 'dd/MM/yyyy')}\n`;
      }
    } else {
      message += language === 'pt'
        ? `📊 Nenhum registro ainda\n`
        : `📊 No logs yet\n`;
    }
    
    await ctx.reply(message);
    return;
  }

  // Regular search in expenses, incomes, investments
  const searchTerm = searchText;
  
  // Search in expenses
  const expenses = await findExpensesByDescription(user.id, searchTerm, 5);
  // Search in incomes
  const incomes = await findIncomesByDescription(user.id, searchTerm, 5);
  // Search in investments
  const investments = await findInvestmentsByName(user.id, searchTerm, 5);
  
  // Search in OKRs (objectives)
  const objectives = await getObjectivesByUser(user.id);
  const matchingObjectives = objectives.filter(obj => 
    obj.title.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);
  
  if (expenses.length === 0 && incomes.length === 0 && investments.length === 0 && matchingObjectives.length === 0) {
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
      message += `  ID: ${expense.id} | R$ ${parseFloat(String(expense.amount)).toFixed(2)} - ${expense.description} (${format(date, 'dd/MM/yyyy')})\n`;
    }
    message += '\n';
  }
  
  if (incomes.length > 0) {
    message += language === 'pt' ? `💰 Receitas:\n` : `💰 Incomes:\n`;
    for (const income of incomes) {
      const date = fromUTC(new Date(income.date), user.timezone || 'America/Sao_Paulo');
      message += `  ID: ${income.id} | R$ ${parseFloat(String(income.amount)).toFixed(2)} - ${income.description} (${format(date, 'dd/MM/yyyy')})\n`;
    }
    message += '\n';
  }
  
  if (investments.length > 0) {
    message += language === 'pt' ? `📈 Investimentos:\n` : `📈 Investments:\n`;
    for (const investment of investments) {
      const currentValue = investment.current_value ? ` (R$ ${parseFloat(String(investment.current_value)).toFixed(2)})` : '';
      message += `  ID: ${investment.id} | ${investment.name} - ${investment.type} - R$ ${parseFloat(String(investment.amount)).toFixed(2)}${currentValue}\n`;
    }
    message += '\n';
  }
  
  if (matchingObjectives.length > 0) {
    message += language === 'pt' ? `🎯 OKRs:\n` : `🎯 OKRs:\n`;
    for (const objective of matchingObjectives) {
      message += `  ID: ${objective.id} | ${objective.title}\n`;
    }
  }
  
  await ctx.reply(message);
});

// Link command - link habit to action
bot.command('link', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const user = await getUserByTelegramId(ctx.from!.id.toString());
  
  if (!user) {
    return ctx.reply(t(language, 'messages.pleaseStart'));
  }
  
  const args = ctx.message.text.substring('/link'.length).trim().split(/\s+/);
  
  if (args.length < 2) {
    return ctx.reply(
      `${t(language, 'messages.usage')}: /link habit <habit_name|habit_id> action <action_id|action_description>\n` +
      `${t(language, 'messages.examples')}:\n` +
      `  /link habit treino action "ir 250x academia"\n` +
      `  /link habit 1 action 5`
    );
  }
  
  // Parse: /link habit <name|id> action <id|description>
  if (args[0].toLowerCase() !== 'habit' || args.length < 4 || args[args.length - 2].toLowerCase() !== 'action') {
    return ctx.reply(
      language === 'pt'
        ? '❌ Formato: /link habit <nome|id> action <id|descrição>'
        : '❌ Format: /link habit <name|id> action <id|description>'
    );
  }
  
  // Extract habit identifier (name or ID)
  const habitIdentifier = args.slice(1, args.length - 2).join(' ');
  const actionIdentifier = args[args.length - 1];
  
  // Find habit
  let habitId: number | null = null;
  const habitIdParsed = parseInt(habitIdentifier);
  
  if (!isNaN(habitIdParsed) && habitIdParsed > 0) {
    const habit = await getHabitById(habitIdParsed, user.id);
    if (habit) {
      habitId = habit.id;
    }
  } else {
    const habit = await findHabitByName(user.id, habitIdentifier);
    if (habit) {
      habitId = habit.id;
    }
  }
  
  if (!habitId) {
    return ctx.reply(
      language === 'pt'
        ? `❌ Hábito "${habitIdentifier}" não encontrado. Use /list habit para ver os hábitos.`
        : `❌ Habit "${habitIdentifier}" not found. Use /list habit to see habits.`
    );
  }
  
  // Find action
  let actionId: number | null = null;
  const actionIdParsed = parseInt(actionIdentifier);
  
  if (!isNaN(actionIdParsed) && actionIdParsed > 0) {
    const action = await getActionById(actionIdParsed);
    if (action) {
      actionId = action.id;
    }
    } else {
    const action = await findActionByDescription(user.id, actionIdentifier);
    if (action) {
      actionId = action.id;
    }
  }
  
  if (!actionId) {
    return ctx.reply(
      language === 'pt'
        ? `❌ Ação "${actionIdentifier}" não encontrada. Use /list okr para ver as ações.`
        : `❌ Action "${actionIdentifier}" not found. Use /list okr to see actions.`
    );
  }
  
  // Link habit to action
  const updated = await linkHabitToAction(habitId, user.id, actionId);
  
  if (updated) {
    const habit = await getHabitById(habitId, user.id);
    const action = await getActionById(actionId);
    await ctx.reply(
      language === 'pt'
        ? `✅ Hábito linkado à ação!\n\n🏋️ ${habit?.name} (ID: ${habitId})\n📝 ${action?.description} (ID: ${actionId})`
        : `✅ Habit linked to action!\n\n🏋️ ${habit?.name} (ID: ${habitId})\n📝 ${action?.description} (ID: ${actionId})`
    );
  } else {
    await ctx.reply(
      language === 'pt'
        ? '❌ Erro ao linkar hábito à ação'
        : '❌ Error linking habit to action'
    );
  }
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
      `${t(language, 'messages.usage')}: /delete <expense|income|investment|habit|okr|kr|action> <id|name>\n` +
      `${t(language, 'messages.examples')}:\n` +
      `  /delete expense 1\n` +
      `  /delete kr peso\n` +
      `  /delete outcome uber`
    );
  }
  
  const entityType = args[0].toLowerCase();
  const identifier = args.slice(1).join(' '); // Can be ID or name/description
  const id = parseInt(identifier);
  
  let deleted = false;
  let foundId: number | null = null;
  
  // Try to parse as ID first, if not, search by name/description
  if (!isNaN(id) && id > 0) {
    foundId = id;
  } else {
    // Search by name/description
    if (entityType === 'expense' || entityType === 'outcome') {
      const expenses = await findExpensesByDescription(user.id, identifier, 1);
      if (expenses.length > 0) {
        foundId = expenses[0].id;
      }
    } else if (entityType === 'income') {
      const incomes = await findIncomesByDescription(user.id, identifier, 1);
      if (incomes.length > 0) {
        foundId = incomes[0].id;
      }
    } else if (entityType === 'investment') {
      const investments = await findInvestmentsByName(user.id, identifier, 1);
      if (investments.length > 0) {
        foundId = investments[0].id;
      }
    } else if (entityType === 'habit') {
      const habit = await findHabitByName(user.id, identifier);
      if (habit) {
        foundId = habit.id;
      }
    } else if (entityType === 'okr' || entityType === 'objective') {
      const objectives = await getObjectivesByUser(user.id);
      const matching = objectives.filter(obj => 
        obj.title.toLowerCase().includes(identifier.toLowerCase())
      );
      if (matching.length > 0) {
        foundId = matching[0].id;
      }
    } else if (entityType === 'kr' || entityType === 'keyresult') {
      const keyResult = await findKeyResultByTitle(user.id, identifier);
      if (keyResult) {
        foundId = keyResult.id;
      }
    } else if (entityType === 'action') {
      const action = await findActionByDescription(user.id, identifier);
      if (action) {
        foundId = action.id;
      }
    }
    
    if (!foundId) {
      return ctx.reply(
        language === 'pt'
          ? `❌ ${entityType} "${identifier}" não encontrado(a). Use /list ${entityType} para ver os IDs.`
          : `❌ ${entityType} "${identifier}" not found. Use /list ${entityType} to see IDs.`
      );
    }
  }
  
  // Now delete using the found ID
  if (entityType === 'expense' || entityType === 'outcome') {
    deleted = await deleteExpense(foundId!, user.id);
  } else if (entityType === 'income') {
    deleted = await deleteIncome(foundId!, user.id);
  } else if (entityType === 'investment') {
    deleted = await deleteInvestment(foundId!, user.id);
  } else if (entityType === 'habit') {
    const habit = await getHabitById(foundId!, user.id);
    if (habit) {
      const { pool } = await import('./config/database');
      const result = await pool.query('DELETE FROM habits WHERE id = $1 AND user_id = $2', [foundId!, user.id]);
      deleted = (result.rowCount ?? 0) > 0;
    }
  } else if (entityType === 'okr' || entityType === 'objective') {
    const objective = await getObjectiveById(foundId!, user.id);
    if (objective) {
      const { pool } = await import('./config/database');
      const result = await pool.query('DELETE FROM objectives WHERE id = $1 AND user_id = $2', [foundId!, user.id]);
      deleted = (result.rowCount ?? 0) > 0;
    }
  } else if (entityType === 'kr' || entityType === 'keyresult') {
    const keyResult = await getKeyResultById(foundId!);
    if (keyResult) {
      const { pool } = await import('./config/database');
      const result = await pool.query('DELETE FROM key_results WHERE id = $1', [foundId!]);
      deleted = (result.rowCount ?? 0) > 0;
    }
  } else if (entityType === 'action') {
    const action = await getActionById(foundId!);
    if (action) {
      const { pool } = await import('./config/database');
      const result = await pool.query('DELETE FROM actions WHERE id = $1', [foundId!]);
      deleted = (result.rowCount ?? 0) > 0;
    }
  } else if (entityType === 'contribution') {
    deleted = await deleteContribution(foundId!, user.id);
  } else {
    return ctx.reply(
      language === 'pt'
        ? '❌ Tipo inválido. Use: expense, income, investment, habit, okr, kr, action, contribution'
        : '❌ Invalid type. Use: expense, income, investment, habit, okr, kr, action, contribution'
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

// All old commands removed - only simplified commands remain

// AI command - create OKR from natural language
bot.command('ai', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const user = await getUserByTelegramId(ctx.from!.id.toString());
  
  if (!user) {
    return ctx.reply(t(language, 'messages.pleaseStart'));
  }
  
  const commandText = ctx.message.text.substring('/ai'.length).trim();
  
  if (!commandText) {
    return ctx.reply(
      language === 'pt'
        ? `${t(language, 'messages.usage')}: /ai <okr|habits|okrs|incomes|outcomes|investments> [texto]\n\n` +
          `Exemplos:\n` +
          `/ai okr "ser uma grande gostosa" com habitos de treinos (5x por semana)\n` +
          `/ai habits "como melhorar treino"\n` +
          `/ai outcomes "como economizar"`
        : `${t(language, 'messages.usage')}: /ai <okr|habits|okrs|incomes|outcomes|investments> [text]\n\n` +
          `Examples:\n` +
          `/ai okr "be fit" with training habits\n` +
          `/ai habits "how to improve training"\n` +
          `/ai outcomes "how to save money"`
    );
  }
  
  // Parse command: /ai <type> [question/text]
  const parts = commandText.split(/\s+/);
  const type = parts[0].toLowerCase();
  const questionOrText = parts.slice(1).join(' ').trim();
  
  // Handle OKR creation (existing functionality)
  if (type === 'okr') {
    const okrText = questionOrText;
    
    if (!okrText) {
      return ctx.reply(
        language === 'pt'
          ? '❌ Por favor, forneça uma descrição do OKR'
          : '❌ Please provide an OKR description'
      );
    }
    
    // Show processing message
    const processingMsg = await ctx.reply(
      language === 'pt'
        ? '🤖 Processando com AI...'
        : '🤖 Processing with AI...'
    );
    
    try {
      // Parse OKR structure from text using AI
      const okrStructure = await parseOKRFromText(okrText, language);
      
      // Create Objective
      const objective = await createObjective(
        user.id,
        okrStructure.title,
        okrStructure.description
      );
      
      let resultMessage = language === 'pt'
        ? `✅ OKR criado!\n\n🎯 ${objective.title} (ID: ${objective.id})\n\n`
        : `✅ OKR created!\n\n🎯 ${objective.title} (ID: ${objective.id})\n\n`;
      
      // Create Key Results - if none provided, create a default one
      const createdKRs: Array<{ id: number; title: string }> = [];
      if (okrStructure.keyResults.length === 0) {
        const defaultKR = await createKeyResult(
          objective.id,
          language === 'pt' ? 'Progresso' : 'Progress',
          undefined,
          undefined
        );
        createdKRs.push({ id: defaultKR.id, title: defaultKR.title });
        resultMessage += language === 'pt'
          ? `📊 KR: ${defaultKR.title} (ID: ${defaultKR.id})\n`
          : `📊 KR: ${defaultKR.title} (ID: ${defaultKR.id})\n`;
      }
      
      for (const kr of okrStructure.keyResults) {
        const keyResult = await createKeyResult(
          objective.id,
          kr.title,
          kr.targetValue,
          kr.unit
        );
        
        // Set current value if provided
        if (kr.currentValue !== undefined) {
          await updateKeyResult(keyResult.id, undefined, undefined, kr.currentValue);
        }
        
        createdKRs.push({ id: keyResult.id, title: keyResult.title });
        resultMessage += language === 'pt'
          ? `📊 KR: ${keyResult.title} (ID: ${keyResult.id})`
          : `📊 KR: ${keyResult.title} (ID: ${keyResult.id})`;
        if (kr.targetValue) {
          resultMessage += ` → ${kr.currentValue || 0}${kr.unit || ''} / ${kr.targetValue}${kr.unit || ''}`;
        }
        resultMessage += '\n';
      }
      
      const createdActions: Array<{ id: number; description: string; krTitle?: string }> = [];
      for (const action of okrStructure.actions) {
        // Find the KR this action belongs to
        let keyResultId: number | null = null;
        if (action.keyResultTitle) {
          const matchingKR = createdKRs.find(kr => 
            kr.title.toLowerCase().includes(action.keyResultTitle!.toLowerCase()) ||
            action.keyResultTitle!.toLowerCase().includes(kr.title.toLowerCase())
          );
          if (matchingKR) {
            keyResultId = matchingKR.id;
          }
        }
        
        // If no specific KR found, use the first one (or default)
        if (!keyResultId && createdKRs.length > 0) {
          keyResultId = createdKRs[0].id;
        }
        
        if (keyResultId) {
          const createdAction = await createAction(keyResultId, action.description);
          createdActions.push({ 
            id: createdAction.id, 
            description: createdAction.description,
            krTitle: action.keyResultTitle
          });
          resultMessage += language === 'pt'
            ? `📝 Ação: ${createdAction.description} (ID: ${createdAction.id})\n`
            : `📝 Action: ${createdAction.description} (ID: ${createdAction.id})\n`;
        }
      }
      
      // Create Habits
      const createdHabits: Array<{ id: number; name: string }> = [];
      for (const habit of okrStructure.habits) {
        const createdHabit = await createHabit(
          user.id,
          habit.name,
          habit.frequencyType,
          habit.frequencyType === 'weekly' ? habit.frequencyValue : undefined,
          habit.description
        );
        createdHabits.push({ id: createdHabit.id, name: createdHabit.name });
        resultMessage += language === 'pt'
          ? `🏋️ Hábito: ${createdHabit.name} (ID: ${createdHabit.id})`
          : `🏋️ Habit: ${createdHabit.name} (ID: ${createdHabit.id})`;
        if (habit.frequencyType === 'weekly' && habit.frequencyValue) {
          resultMessage += ` - ${habit.frequencyValue}x por semana`;
        } else {
          resultMessage += language === 'pt' ? ' - Diário' : ' - Daily';
        }
        resultMessage += '\n';
        
        // Link habit to action - try explicit link first, then try to match by name
        let linked = false;
        if (habit.linkedActionDescription && createdActions.length > 0) {
          const matchingAction = createdActions.find(a =>
            a.description.toLowerCase().includes(habit.linkedActionDescription!.toLowerCase()) ||
            habit.linkedActionDescription!.toLowerCase().includes(a.description.toLowerCase())
          );
          
          if (matchingAction) {
            await linkHabitToAction(createdHabit.id, user.id, matchingAction.id);
            resultMessage += language === 'pt'
              ? `  🔗 Linkado à ação: ${matchingAction.description}\n`
              : `  🔗 Linked to action: ${matchingAction.description}\n`;
            linked = true;
          }
        }
        
        // If not linked yet, try to match habit name with action description
        if (!linked && createdActions.length > 0) {
          const matchingAction = createdActions.find(a => {
            const habitNameLower = createdHabit.name.toLowerCase();
            const actionDescLower = a.description.toLowerCase();
            return habitNameLower.includes(actionDescLower) || 
                   actionDescLower.includes(habitNameLower) ||
                   habitNameLower.includes('trein') && actionDescLower.includes('trein') ||
                   habitNameLower.includes('cardio') && actionDescLower.includes('cardio') ||
                   habitNameLower.includes('dieta') && actionDescLower.includes('dieta') ||
                   habitNameLower.includes('água') && actionDescLower.includes('água') ||
                   habitNameLower.includes('agua') && actionDescLower.includes('agua');
          });
          
          if (matchingAction) {
            await linkHabitToAction(createdHabit.id, user.id, matchingAction.id);
            resultMessage += language === 'pt'
              ? `  🔗 Linkado à ação: ${matchingAction.description}\n`
              : `  🔗 Linked to action: ${matchingAction.description}\n`;
          }
        }
      }
      
      // Update the processing message with results
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        resultMessage
      );
    
    } catch (error: any) {
      console.error('AI OKR creation error:', error);
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        language === 'pt'
          ? `❌ Erro ao criar OKR: ${error.message || 'Erro desconhecido'}`
          : `❌ Error creating OKR: ${error.message || 'Unknown error'}`
      );
    }
    return;
  }
  
  // Handle insights/overviews for habits, okrs, incomes, outcomes, investments
  const insightTypes: Array<'habits' | 'okrs' | 'incomes' | 'outcomes' | 'investments'> = ['habits', 'okrs', 'incomes', 'outcomes', 'investments'];
  
  if (insightTypes.includes(type as any)) {
    const processingMsg = await ctx.reply(
      language === 'pt'
        ? '🤖 Processando com AI...'
        : '🤖 Processing with AI...'
    );
    
    try {
      const timezone = user.timezone || 'America/Sao_Paulo';
      const now = nowInTimezone(timezone);
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      let userData = '';
      
      if (type === 'habits') {
        const habits = await getHabitsByUser(user.id);
        const habitsReview = await getAllHabitsYearlyReview(user.id, currentYear, timezone);
        userData = `Hábitos:\n`;
        for (const { habit, count } of habitsReview) {
          const stats = await getHabitStats(habit.id, currentYear, timezone);
          userData += `- ${habit.name}: ${count} dias completados este ano (${stats.percentage.toFixed(1)}%), sequência: ${stats.streak} dias\n`;
        }
        if (habits.length === 0) {
          userData += 'Nenhum hábito cadastrado ainda.\n';
        }
      } else if (type === 'okrs') {
        const objectives = await getObjectivesByUser(user.id);
        userData = `OKRs:\n`;
        for (const objective of objectives) {
          userData += `- ${objective.title}${objective.description ? `: ${objective.description}` : ''}\n`;
          const keyResults = await getKeyResultsByObjective(objective.id);
          for (const kr of keyResults) {
            userData += `  KR: ${kr.title}`;
            if (kr.target_value) {
              userData += ` → ${kr.current_value || 0}${kr.unit || ''} / ${kr.target_value}${kr.unit || ''}`;
            }
            userData += '\n';
            const actions = await getActionsByKeyResult(kr.id);
            for (const action of actions) {
              userData += `    Ação: ${action.description}${action.progress ? ` (${action.progress})` : ''}\n`;
            }
          }
        }
        if (objectives.length === 0) {
          userData += 'Nenhum OKR cadastrado ainda.\n';
        }
      } else if (type === 'incomes') {
        const incomes = await getIncomesByUser(user.id);
        const totalThisMonth = await getTotalIncomesByMonth(user.id, currentYear, currentMonth, timezone);
        const byCategory = await getIncomesByCategory(user.id, startOfMonth(now), endOfMonth(now));
        userData = `Receitas:\n`;
        userData += `Total este mês: R$ ${totalThisMonth.toFixed(2)}\n`;
        userData += `Por categoria:\n`;
        for (const cat of byCategory) {
          userData += `- ${cat.category}: R$ ${cat.total.toFixed(2)} (${cat.count} transações)\n`;
        }
        if (incomes.length === 0) {
          userData += 'Nenhuma receita cadastrada ainda.\n';
        }
      } else if (type === 'outcomes') {
        const expenses = await getExpensesByUser(user.id);
        const totalThisMonth = await getTotalExpensesByMonth(user.id, currentYear, currentMonth, timezone);
        const byCategory = await getExpensesByCategory(user.id, startOfMonth(now), endOfMonth(now));
        userData = `Despesas:\n`;
        userData += `Total este mês: R$ ${totalThisMonth.toFixed(2)}\n`;
        userData += `Por categoria:\n`;
        for (const cat of byCategory) {
          userData += `- ${cat.category}: R$ ${cat.total.toFixed(2)} (${cat.count} transações)\n`;
        }
        if (expenses.length === 0) {
          userData += 'Nenhuma despesa cadastrada ainda.\n';
        }
      } else if (type === 'investments') {
        const investments = await getInvestmentsByUser(user.id);
        const totals = await getTotalInvestments(user.id);
        userData = `Investimentos:\n`;
        userData += `Total investido: R$ ${totals.total_invested.toFixed(2)}\n`;
        userData += `Valor atual: R$ ${totals.total_value.toFixed(2)}\n`;
        userData += `Investimentos:\n`;
        for (const inv of investments) {
          userData += `- ${inv.name} (${inv.type}): R$ ${parseFloat(String(inv.amount)).toFixed(2)}`;
          if (inv.current_value) {
            userData += ` → R$ ${parseFloat(String(inv.current_value)).toFixed(2)}`;
          }
          userData += '\n';
        }
        if (investments.length === 0) {
          userData += 'Nenhum investimento cadastrado ainda.\n';
        }
      }
      
      const insight = await generateAIInsight(
        type as 'habits' | 'okrs' | 'incomes' | 'outcomes' | 'investments',
        userData,
        questionOrText || undefined,
        language
      );
      
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        `🤖 ${insight}`
      );
    } catch (error: any) {
      console.error(`AI ${type} insight error:`, error);
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        language === 'pt'
          ? `❌ Erro ao processar: ${error.message || 'Erro desconhecido'}`
          : `❌ Error processing: ${error.message || 'Unknown error'}`
      );
    }
    return;
  }
  
  // Unknown type
  await ctx.reply(
    language === 'pt'
      ? '❌ Tipo desconhecido. Use: okr, habits, okrs, incomes, outcomes, investments'
      : '❌ Unknown type. Use: okr, habits, okrs, incomes, outcomes, investments'
  );
});

// Habit command - log habit
bot.command('habit', async (ctx) => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const language = await getUserLanguage(ctx.from!.id.toString());
  const user = await getUserByTelegramId(ctx.from!.id.toString());
  
  if (!user) {
    return ctx.reply(t(language, 'messages.pleaseStart'));
  }
  
  const args = ctx.message.text.substring('/habit'.length).trim().split(/\s+/);
  
  if (args.length < 1) {
    return ctx.reply(
      language === 'pt'
        ? `${t(language, 'messages.usage')}: /habit <nome> [data YYYY-MM-DD]\n${t(language, 'messages.example')}: /habit treino\n${t(language, 'messages.example')}: /habit treino 2024-01-15`
        : `${t(language, 'messages.usage')}: /habit <name> [date YYYY-MM-DD]\n${t(language, 'messages.example')}: /habit training\n${t(language, 'messages.example')}: /habit training 2024-01-15`
    );
  }
  
  const habitName = args[0];
  const dateStr = args[1];
  
  await handleLogHabit(ctx, habitName, undefined, dateStr);
});

// Spreadsheet commands removed as requested - only /report, /categories, /refer remain

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

