// @ts-ignore - googleapis types may need adjustment
const { google } = require('googleapis');
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { generateAllSheets, SpreadsheetSheet } from './spreadsheetService';

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

export async function createSpreadsheetIfNotExists(userId: number, userName: string, year: number): Promise<string> {
  await initializeSheets();

  // Check if spreadsheet already exists
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  if (spreadsheetId) {
    return spreadsheetId;
  }

  // Create new spreadsheet with multiple sheets
  const sheetNames = [`OKRs ${year}`, `Investments ${year}`, `Income ${year}`, `Expenses ${year}`];
  
  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `Diindiin - ${userName} - ${year}`,
      },
      sheets: sheetNames.map(name => ({
        properties: {
          title: name,
        },
      })),
    },
  });

  return response.data.spreadsheetId!;
}

export async function updateSheetData(
  spreadsheetId: string,
  sheetName: string,
  data: Array<Array<string | number>>
): Promise<void> {
  await initializeSheets();

  // Clear existing data
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });
  } catch (error) {
    // Sheet might not exist, that's okay
    console.log(`Sheet ${sheetName} might not exist, will create it`);
  }

  // Update with new data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: data,
    },
  });
}

export async function createOrUpdateSheet(
  spreadsheetId: string,
  sheetName: string,
  data: Array<Array<string | number>>
): Promise<void> {
  await initializeSheets();

  // Get existing sheets
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const existingSheets = spreadsheet.data.sheets || [];
  const sheetExists = existingSheets.some((sheet: any) => sheet.properties.title === sheetName);

  if (!sheetExists) {
    // Add new sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
  }

  // Update data
  await updateSheetData(spreadsheetId, sheetName, data);
}

export async function uploadToGoogleSheets(
  userId: number,
  userName: string,
  csvFilePath?: string
): Promise<string> {
  try {
    await initializeSheets();

    const year = new Date().getFullYear();
    const spreadsheetId = await createSpreadsheetIfNotExists(userId, userName, year);
    const allSheets = await generateAllSheets(userId, userName, year);

    // Update each sheet
    for (const sheet of allSheets) {
      await createOrUpdateSheet(spreadsheetId, sheet.name, sheet.data);
    }

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  } catch (error) {
    console.error('Error uploading to Google Sheets:', error);
    throw error;
  }
}
