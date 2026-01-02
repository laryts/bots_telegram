import { Context } from 'telegraf';
import { getUserByTelegramId } from '../models/User';
import { generateCSV, formatForTelegram } from '../services/spreadsheetService';
import { uploadToGoogleSheets } from '../services/googleSheetsService';
import * as fs from 'fs';

export async function handleGenerateSpreadsheet(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const userName = user.first_name || user.username || 'User';
    const filePath = await generateCSV(user.id, userName);

    // Send CSV file
    await ctx.replyWithDocument({
      source: filePath,
      filename: `spreadsheet_${new Date().getFullYear()}.csv`
    });

    // Clean up temp file
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 5000);

    await ctx.reply('✅ Spreadsheet generated and sent!');
  } catch (error) {
    console.error('Error generating spreadsheet:', error);
    await ctx.reply('❌ Error generating spreadsheet. Please try again.');
  }
}

export async function handleViewSpreadsheet(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const userName = user.first_name || user.username || 'User';
    const message = await formatForTelegram(user.id, userName);

    await ctx.reply(message);
  } catch (error) {
    console.error('Error viewing spreadsheet:', error);
    await ctx.reply('❌ Error viewing spreadsheet. Please try again.');
  }
}

export async function handleSyncSheets(ctx: Context) {
  try {
    const user = await getUserByTelegramId(ctx.from!.id.toString());
    
    if (!user) {
      return ctx.reply('Please start the bot first with /start');
    }

    const userName = user.first_name || user.username || 'User';
    const filePath = await generateCSV(user.id, userName);

    try {
      await uploadToGoogleSheets(user.id, userName, filePath);
      await ctx.reply('✅ Spreadsheet synced to Google Sheets!');
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      await ctx.reply('❌ Error syncing to Google Sheets. Please check your credentials.');
    } finally {
      // Clean up temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Error syncing sheets:', error);
    await ctx.reply('❌ Error syncing sheets. Please try again.');
  }
}

