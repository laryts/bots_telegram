import { getUserByTelegramId } from '../models/User';
import { getObjectivesByUser, getKeyResultsByObjective, getActionsByKeyResult } from '../models/OKR';
import { getHabitsByUser, getAllHabitsYearlyReview } from '../models/Habit';
import { getMonthlyExpenses, getExpensesByCategory, getTotalExpensesByMonth } from '../models/Expense';
import { getTotalInvestments } from '../models/Investment';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';

// @ts-ignore - csv-writer may not have types
const { createObjectCsvWriter } = require('csv-writer');

export interface SpreadsheetRow {
  objetivos?: string;
  krs?: string;
  acoes?: string;
  progresso?: string;
}

export async function generateSpreadsheetData(userId: number, userName: string): Promise<SpreadsheetRow[]> {
  const rows: SpreadsheetRow[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;

  // Header row
  rows.push({
    objetivos: userName,
    krs: '',
    acoes: '',
    progresso: ''
  });

  // Column headers
  rows.push({
    objetivos: 'Objetivos (até dez23)',
    krs: 'KRs',
    acoes: 'Ações',
    progresso: 'Progresso'
  });

  // OKRs
  const objectives = await getObjectivesByUser(userId);
  for (const objective of objectives) {
    const keyResults = await getKeyResultsByObjective(objective.id);
    
    if (keyResults.length === 0) {
      rows.push({
        objetivos: objective.title,
        krs: '',
        acoes: '',
        progresso: ''
      });
    } else {
      for (let i = 0; i < keyResults.length; i++) {
        const kr = keyResults[i];
        const actions = await getActionsByKeyResult(kr.id);

        if (actions.length === 0) {
          rows.push({
            objetivos: i === 0 ? objective.title : '',
            krs: kr.title,
            acoes: '',
            progresso: kr.current_value ? `${kr.current_value}${kr.unit || ''}` : ''
          });
        } else {
          for (let j = 0; j < actions.length; j++) {
            rows.push({
              objetivos: i === 0 && j === 0 ? objective.title : '',
              krs: j === 0 ? kr.title : '',
              acoes: actions[j].description,
              progresso: actions[j].progress || ''
            });
          }
        }
      }
    }
  }

  // Financial data
  const totalExpenses = await getTotalExpensesByMonth(userId, currentYear, month);
  const expensesByCategory = await getExpensesByCategory(
    userId,
    startOfMonth(now),
    endOfMonth(now)
  );
  const investments = await getTotalInvestments(userId);

  rows.push({
    objetivos: 'Melhorar financeiramente',
    krs: 'Total de dinheiro investido/reservado',
    acoes: `Ter X guardados reserva nubank`,
    progresso: 'hoje'
  });

  rows.push({
    objetivos: '',
    krs: '',
    acoes: `Gastos do mês`,
    progresso: totalExpenses.toFixed(2)
  });

  rows.push({
    objetivos: '',
    krs: '',
    acoes: `Investimentos`,
    progresso: investments.total_invested.toFixed(2)
  });

  // Habits
  const habitsReview = await getAllHabitsYearlyReview(userId, currentYear);
  if (habitsReview.length > 0) {
    for (const { habit, count } of habitsReview) {
      rows.push({
        objetivos: '',
        krs: '',
        acoes: habit.name,
        progresso: `${count} dias`
      });
    }
  }

  return rows;
}

export async function generateCSV(userId: number, userName: string): Promise<string> {
  const data = await generateSpreadsheetData(userId, userName);
  const tempDir = path.join(__dirname, '../../temp');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.join(tempDir, `spreadsheet_${userId}_${Date.now()}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'objetivos', title: 'Objetivos (até dez23)' },
      { id: 'krs', title: 'KRs' },
      { id: 'acoes', title: 'Ações' },
      { id: 'progresso', title: 'Progresso' }
    ],
    encoding: 'utf8'
  });

  await csvWriter.writeRecords(data);
  return filePath;
}

export async function formatForTelegram(userId: number, userName: string): Promise<string> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;

  let message = `📊 Spreadsheet Preview - ${userName}\n\n`;

  // OKRs
  const objectives = await getObjectivesByUser(userId);
  if (objectives.length > 0) {
    message += `🎯 OKRs:\n`;
    for (const objective of objectives) {
      message += `\n${objective.title}\n`;
      const keyResults = await getKeyResultsByObjective(objective.id);
      for (const kr of keyResults) {
        message += `  📊 ${kr.title}\n`;
        const actions = await getActionsByKeyResult(kr.id);
        for (const action of actions) {
          message += `    📝 ${action.description}`;
          if (action.progress) {
            message += ` (${action.progress})`;
          }
          message += `\n`;
        }
      }
    }
    message += `\n`;
  }

  // Financial
  const totalExpenses = await getTotalExpensesByMonth(userId, currentYear, month);
  const investments = await getTotalInvestments(userId);
  
  message += `💰 Financial:\n`;
  message += `  Expenses this month: R$ ${totalExpenses.toFixed(2)}\n`;
  message += `  Total invested: R$ ${investments.total_invested.toFixed(2)}\n`;
  message += `  Current value: R$ ${investments.total_value.toFixed(2)}\n\n`;

  // Habits
  const habitsReview = await getAllHabitsYearlyReview(userId, currentYear);
  if (habitsReview.length > 0) {
    message += `🏋️ Habits (${currentYear}):\n`;
    for (const { habit, count } of habitsReview) {
      message += `  ${habit.name}: ${count} days\n`;
    }
  }

  return message;
}

