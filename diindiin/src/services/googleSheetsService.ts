// @ts-ignore - googleapis types may need adjustment
// @ts-ignore - googleapis types may need adjustment
const { google } = require('googleapis');
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { generateSpreadsheetData } from './spreadsheetService';

dotenv.config();

let sheets: any = null;

async function initializeSheets() {
  if (sheets) return sheets;

  try {
    const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    
    if (!credentials) {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS not configured');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentials),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheets = google.sheets({ version: 'v4', auth });
    return sheets;
  } catch (error) {
    console.error('Error initializing Google Sheets:', error);
    throw error;
  }
}

export async function createSpreadsheetIfNotExists(userId: number, userName: string): Promise<string> {
  await initializeSheets();

  // Check if spreadsheet already exists (you might want to store spreadsheet IDs in database)
  // For now, we'll create a new one each time or use a fixed ID from env
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  if (spreadsheetId) {
    return spreadsheetId;
  }

  // Create new spreadsheet
  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `Diindiin - ${userName} - ${new Date().getFullYear()}`,
      },
    },
  });

  return response.data.spreadsheetId!;
}

export async function updateSpreadsheetData(
  spreadsheetId: string,
  data: Array<Array<string | number>>
): Promise<void> {
  await initializeSheets();

  // Clear existing data
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Sheet1!A:Z',
  });

  // Update with new data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: data,
    },
  });
}

export async function uploadToGoogleSheets(
  userId: number,
  userName: string,
  csvFilePath?: string
): Promise<string> {
  try {
    await initializeSheets();

    const spreadsheetId = await createSpreadsheetIfNotExists(userId, userName);
    const data = await generateSpreadsheetData(userId, userName);

    // Convert to 2D array format for Google Sheets
    const values: Array<Array<string>> = [
      ['Objetivos (até dez23)', 'KRs', 'Ações', 'Progresso'],
    ];

    for (const row of data) {
      values.push([
        row.objetivos || '',
        row.krs || '',
        row.acoes || '',
        row.progresso || '',
      ]);
    }

    await updateSpreadsheetData(spreadsheetId, values);

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  } catch (error) {
    console.error('Error uploading to Google Sheets:', error);
    throw error;
  }
}

