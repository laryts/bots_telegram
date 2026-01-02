# Diindiin Bot - Personal Finance Manager

Telegram bot for managing personal finances with expense tracking, investment management, and AI-powered insights.

## Features

- 💰 Expense tracking with categories
- 📊 Monthly reports and analytics
- 📈 Investment tracking
- 🤖 AI-powered categorization and insights
- 👥 Multi-user support with referral system

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

3. Run database migrations:
```bash
npm run migrate up
```

4. Start the bot:
```bash
npm run dev
```

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from @BotFather
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for AI features

## Commands

- `/start` - Start the bot and register
- `/add` - Add an expense (value and description)
- `/report` - View monthly report
- `/categories` - View expenses by category
- `/investments` - Manage investments
- `/refer` - Get referral link

