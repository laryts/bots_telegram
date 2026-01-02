import { getUserByTelegramId } from '../models/User';
import { getObjectivesByUser, getKeyResultsByObjective, getActionsByKeyResult } from '../models/OKR';
import { getHabitsByUser, getAllHabitsYearlyReview } from '../models/Habit';
import { 
  getExpensesByCategoryAndMonth, 
  getTotalExpensesByMonth,
  getExpensesByCategory 
} from '../models/Expense';
import { 
  getIncomesByCategoryAndMonth,
  getTotalIncomesByMonth,
  getIncomesByCategory
} from '../models/Income';
import { 
  getInvestmentsByUser,
  getInvestmentsByTypeAndMonth,
  getTotalInvestments 
} from '../models/Investment';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';

// @ts-ignore - csv-writer may not have types
const { createObjectCsvWriter } = require('csv-writer');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SpreadsheetSheet {
  name: string;
  data: Array<Array<string | number>>;
}

// Generate OKRs sheet (similar to original format)
export async function generateOKRSheet(userId: number, userName: string, year: number): Promise<SpreadsheetSheet> {
  const rows: Array<Array<string>> = [];
  
  // Header
  rows.push([userName, '', '', '']);
  rows.push(['Objetivos (até dez23)', 'KRs', 'Ações', 'Progresso']);

  const objectives = await getObjectivesByUser(userId);
  for (const objective of objectives) {
    const keyResults = await getKeyResultsByObjective(objective.id);
    
    if (keyResults.length === 0) {
      rows.push([objective.title, '', '', '']);
    } else {
      for (let i = 0; i < keyResults.length; i++) {
        const kr = keyResults[i];
        const actions = await getActionsByKeyResult(kr.id);

        if (actions.length === 0) {
          rows.push([
            i === 0 ? objective.title : '',
            kr.title,
            '',
            kr.current_value ? `${kr.current_value}${kr.unit || ''}` : ''
          ]);
        } else {
          for (let j = 0; j < actions.length; j++) {
            rows.push([
              i === 0 && j === 0 ? objective.title : '',
              j === 0 ? kr.title : '',
              actions[j].description,
              actions[j].progress || ''
            ]);
          }
        }
      }
    }
  }

  // Habits
  const habitsReview = await getAllHabitsYearlyReview(userId, year);
  if (habitsReview.length > 0) {
    rows.push(['', '', '', '']);
    for (const { habit, count } of habitsReview) {
      rows.push(['', '', habit.name, `${count} dias`]);
    }
  }

  return { name: `OKRs ${year}`, data: rows };
}

// Generate Income sheet with monthly structure
export async function generateIncomeSheet(userId: number, year: number): Promise<SpreadsheetSheet> {
  const rows: Array<Array<string | number>> = [];
  
  // Title
  rows.push(['', 'Income', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  
  // Header row with months
  const header = ['', '', 'Monthly totals: (in cad)', ...MONTHS, 'Total', 'Average'];
  rows.push(header);
  
  // Monthly totals row
  const monthlyTotals: Array<string | number> = ['', '', 'Monthly totals:', ...Array(12).fill(0), 0, 0];
  let yearTotal = 0;
  for (let month = 1; month <= 12; month++) {
    const total = await getTotalIncomesByMonth(userId, year, month);
    monthlyTotals[month + 2] = total; // +2 for empty columns at start
    yearTotal += total;
  }
  monthlyTotals[15] = yearTotal; // Total column (P = index 15)
  monthlyTotals[16] = yearTotal / 12; // Average column (Q = index 16)
  rows.push(monthlyTotals);

  // Get all categories
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const categories = await getIncomesByCategory(userId, startDate, endDate);
  const monthlyData = await getIncomesByCategoryAndMonth(userId, year);

  // Create map for quick lookup
  const categoryMonthMap: { [key: string]: { [month: number]: number } } = {};
  for (const item of monthlyData) {
    if (!categoryMonthMap[item.category]) {
      categoryMonthMap[item.category] = {};
    }
    categoryMonthMap[item.category][item.month] = item.total;
  }

  // Add each category
  for (const category of categories) {
    const categoryRow: Array<string | number> = ['', category.category, ...Array(12).fill(0), 0, 0];
    
    let categoryTotal = 0;
    for (let month = 1; month <= 12; month++) {
      const amount = categoryMonthMap[category.category]?.[month] || 0;
      categoryRow[month + 2] = amount; // Jan=3, Feb=4, ..., Dec=14
      categoryTotal += amount;
    }
    
    categoryRow[15] = categoryTotal; // Total column (P = index 15)
    categoryRow[16] = categoryTotal / 12; // Average column (Q = index 16)
    rows.push(categoryRow);
  }

  return { name: `Income ${year}`, data: rows };
}

// Generate Expenses sheet with monthly structure
export async function generateExpensesSheet(userId: number, year: number): Promise<SpreadsheetSheet> {
  const rows: Array<Array<string | number>> = [];
  
  // Title
  rows.push(['', '', 'Expenses', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  
  // Header row
  const header = ['', '', '', ...MONTHS, 'Total', 'Average'];
  rows.push(header);
  
  // TOTAL row
  // Structure: ['', 'TOTAL', '', Jan, Feb, ..., Dec, Total, Average]
  // Indices:    0    1       2    3   4        14   15     16
  const totalRow: Array<string | number> = ['', 'TOTAL', '', ...Array(12).fill(0), 0, 0];
  let yearTotalExpenses = 0;
  for (let month = 1; month <= 12; month++) {
    const total = await getTotalExpensesByMonth(userId, year, month);
    totalRow[month + 2] = total; // Jan=3, Feb=4, ..., Dec=14
    yearTotalExpenses += total;
  }
  totalRow[15] = yearTotalExpenses; // Total column (P = index 15)
  totalRow[16] = yearTotalExpenses / 12; // Average column (Q = index 16)
  rows.push(totalRow);

  // Get categories
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const categories = await getExpensesByCategory(userId, startDate, endDate);
  const monthlyData = await getExpensesByCategoryAndMonth(userId, year);

  // Create map
  const categoryMonthMap: { [key: string]: { [month: number]: number } } = {};
  for (const item of monthlyData) {
    if (!categoryMonthMap[item.category]) {
      categoryMonthMap[item.category] = {};
    }
    categoryMonthMap[item.category][item.month] = item.total;
  }

  // Group categories (you can customize this grouping)
  const categoryGroups: { [group: string]: string[] } = {
    'Debt': ['Credit cards', 'Dívida'],
    'Entertainment': ['Entertainment', 'Books', 'Concerts/shows', 'Games', 'Hobbies', 'Movies', 'Music', 'Outdoor activities', 'Photography', 'Sports', 'Theater/plays'],
    'Everyday': ['Food', 'Transport', 'Shopping', 'Delivery', 'Restaurants', 'Personal supplies', 'Clothes', 'Laundry/dry cleaning', 'Hair/beauty', 'Subscriptions']
  };

  // Add grouped categories
  for (const [groupName, groupCategories] of Object.entries(categoryGroups)) {
    rows.push(['', groupName, '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    
    // Monthly totals for group
    const groupTotalsRow: Array<string | number> = ['', 'Monthly totals:', '', ...Array(12).fill(0), 0, 0];
    let groupTotal = 0;
    
    for (let month = 1; month <= 12; month++) {
      let monthTotal = 0;
      for (const cat of groupCategories) {
        monthTotal += categoryMonthMap[cat]?.[month] || 0;
      }
      groupTotalsRow[month + 2] = monthTotal; // Jan=3, Feb=4, ..., Dec=14
      groupTotal += monthTotal;
    }
    groupTotalsRow[15] = groupTotal; // Total column (P = index 15)
    groupTotalsRow[16] = groupTotal / 12; // Average column (Q = index 16)
    rows.push(groupTotalsRow);

    // Individual categories in group
    for (const catName of groupCategories) {
      const cat = categories.find(c => c.category === catName);
      if (cat) {
        const catRow: Array<string | number> = ['', cat.category, '', ...Array(12).fill(0), 0, 0];
        let catTotal = 0;
        
        for (let month = 1; month <= 12; month++) {
          const amount = categoryMonthMap[cat.category]?.[month] || 0;
          catRow[month + 2] = amount; // Jan=3, Feb=4, ..., Dec=14
          catTotal += amount;
        }
        
        catRow[15] = catTotal; // Total column (P = index 15)
        catRow[16] = catTotal / 12; // Average column (Q = index 16)
        rows.push(catRow);
      }
    }
  }

  // Add uncategorized expenses
  const uncategorized = categories.filter(cat => 
    !Object.values(categoryGroups).flat().includes(cat.category)
  );
  
  if (uncategorized.length > 0) {
    rows.push(['', 'Other', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    for (const cat of uncategorized) {
      const catRow: Array<string | number> = ['', cat.category, '', ...Array(12).fill(0), 0, 0];
      let catTotal = 0;
      
      for (let month = 1; month <= 12; month++) {
        const amount = categoryMonthMap[cat.category]?.[month] || 0;
        catRow[month + 2] = amount;
        catTotal += amount;
      }
      
      catRow[15] = catTotal; // Total column (P = index 15)
      catRow[16] = catTotal / 12; // Average column (Q = index 16)
      rows.push(catRow);
    }
  }

  return { name: `Expenses ${year}`, data: rows };
}

// Generate Investments sheet with monthly structure
export async function generateInvestmentsSheet(userId: number, year: number): Promise<SpreadsheetSheet> {
  const rows: Array<Array<string | number>> = [];
  
  // Title
  rows.push(['', '', 'Investments', '', '', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '', `EM REAIS`, '', '', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '', `Dez ${year}`, '', '', '', '', '', '', '', '', '', '', '', '']);
  
  // Header row
  const header = ['', '', 'Monthly totals:', ...MONTHS];
  rows.push(header);
  
  // Monthly totals row
  const monthlyTotals: Array<string | number> = ['', '', 'Monthly totals:', ...Array(12).fill(0)];
  const monthlyData = await getInvestmentsByTypeAndMonth(userId, year);
  
  // Create map
  const typeMonthMap: { [type: string]: { [month: number]: number } } = {};
  for (const item of monthlyData) {
    if (!typeMonthMap[item.type]) {
      typeMonthMap[item.type] = {};
    }
    typeMonthMap[item.type][item.month] = item.total;
  }

  // Calculate monthly totals
  for (let month = 1; month <= 12; month++) {
    let monthTotal = 0;
    for (const type in typeMonthMap) {
      monthTotal += typeMonthMap[type][month] || 0;
    }
    monthlyTotals[month + 2] = monthTotal;
  }
  rows.push(monthlyTotals);

  // Get all investment types
  const investments = await getInvestmentsByUser(userId);
  const types = [...new Set(investments.map(inv => inv.type))];

  // Add each investment type
  for (const type of types) {
    const typeRow: Array<string | number> = ['', '', type, ...Array(12).fill(0)];
    
    for (let month = 1; month <= 12; month++) {
      typeRow[month + 2] = typeMonthMap[type]?.[month] || 0;
    }
    
    rows.push(typeRow);
  }

  return { name: `Investments ${year}`, data: rows };
}

// Generate all sheets
export async function generateAllSheets(userId: number, userName: string, year: number): Promise<SpreadsheetSheet[]> {
  const sheets: SpreadsheetSheet[] = [];
  
  sheets.push(await generateOKRSheet(userId, userName, year));
  sheets.push(await generateIncomeSheet(userId, year));
  sheets.push(await generateExpensesSheet(userId, year));
  sheets.push(await generateInvestmentsSheet(userId, year));
  
  return sheets;
}

// Legacy function for backward compatibility (OKRs format)
export async function generateSpreadsheetData(userId: number, userName: string): Promise<Array<{ objetivos?: string; krs?: string; acoes?: string; progresso?: string }>> {
  const year = new Date().getFullYear();
  const okrSheet = await generateOKRSheet(userId, userName, year);
  
  // Convert to legacy format
  return okrSheet.data.map(row => ({
    objetivos: row[0]?.toString() || '',
    krs: row[1]?.toString() || '',
    acoes: row[2]?.toString() || '',
    progresso: row[3]?.toString() || ''
  }));
}

// Generate CSV (single sheet - OKRs for now)
export async function generateCSV(userId: number, userName: string): Promise<string> {
  const year = new Date().getFullYear();
  const okrSheet = await generateOKRSheet(userId, userName, year);
  const tempDir = path.join(__dirname, '../../temp');
  
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

  const data = okrSheet.data.slice(2).map(row => ({
    objetivos: row[0]?.toString() || '',
    krs: row[1]?.toString() || '',
    acoes: row[2]?.toString() || '',
    progresso: row[3]?.toString() || ''
  }));

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
  const totalIncomes = await getTotalIncomesByMonth(userId, currentYear, month);
  const investments = await getTotalInvestments(userId);
  
  message += `💰 Financial:\n`;
  message += `  Income this month: R$ ${totalIncomes.toFixed(2)}\n`;
  message += `  Expenses this month: R$ ${totalExpenses.toFixed(2)}\n`;
  message += `  Balance: R$ ${(totalIncomes - totalExpenses).toFixed(2)}\n`;
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
