import { Context } from 'telegraf';
import { getUserByTelegramId } from '../models/User';
import { 
  getMonthlyExpenses, 
  getExpensesByCategory, 
  getTotalExpensesByMonth 
} from '../models/Expense';
import { 
  getMonthlyIncomes,
  getIncomesByCategory,
  getTotalIncomesByMonth 
} from '../models/Income';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';

// @ts-ignore - csv-writer may not have types
const { createObjectCsvWriter } = require('csv-writer');

export async function handleReportCSV(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const expenses = await getMonthlyExpenses(user.id, year, month);
    const incomes = await getMonthlyIncomes(user.id, year, month);
    const totalExpenses = await getTotalExpensesByMonth(user.id, year, month);
    const totalIncomes = await getTotalIncomesByMonth(user.id, year, month);

    if (expenses.length === 0 && incomes.length === 0) {
      return ctx.reply('📊 No transactions recorded for this month.');
    }

    // Create temp directory
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `report_${year}_${month.toString().padStart(2, '0')}_${Date.now()}.csv`;
    const filePath = path.join(tempDir, fileName);

    // Prepare CSV data
    const csvData: Array<{
      type: string;
      date: string;
      amount: string;
      category: string;
      description: string;
    }> = [];

    // Add incomes
    for (const income of incomes) {
      csvData.push({
        type: 'Income',
        date: format(new Date(income.date), 'dd/MM/yyyy'),
        amount: `R$ ${income.amount.toFixed(2)}`,
        category: income.category,
        description: income.description
      });
    }

    // Add expenses
    for (const expense of expenses) {
      csvData.push({
        type: 'Expense',
        date: format(new Date(expense.date), 'dd/MM/yyyy'),
        amount: `R$ ${expense.amount.toFixed(2)}`,
        category: expense.category,
        description: expense.description
      });
    }

    // Add summary rows
    csvData.push({
      type: 'SUMMARY',
      date: '',
      amount: '',
      category: '',
      description: ''
    });
    csvData.push({
      type: 'SUMMARY',
      date: 'Total Income',
      amount: `R$ ${totalIncomes.toFixed(2)}`,
      category: '',
      description: ''
    });
    csvData.push({
      type: 'SUMMARY',
      date: 'Total Expenses',
      amount: `R$ ${totalExpenses.toFixed(2)}`,
      category: '',
      description: ''
    });
    csvData.push({
      type: 'SUMMARY',
      date: 'Balance',
      amount: `R$ ${(totalIncomes - totalExpenses).toFixed(2)}`,
      category: '',
      description: ''
    });

    // Write CSV
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'type', title: 'Type' },
        { id: 'date', title: 'Date' },
        { id: 'amount', title: 'Amount' },
        { id: 'category', title: 'Category' },
        { id: 'description', title: 'Description' }
      ],
      encoding: 'utf8'
    });

    await csvWriter.writeRecords(csvData);

    // Send CSV file
    await ctx.replyWithDocument({
      source: filePath,
      filename: `Monthly_Report_${format(now, 'MMMM_yyyy')}.csv`
    });

    // Clean up temp file after a delay
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 5000);

    await ctx.reply('✅ Report CSV generated and sent!');
  } catch (error) {
    console.error('Error generating report CSV:', error);
    await ctx.reply('❌ Error generating report CSV. Please try again.');
  }
}

