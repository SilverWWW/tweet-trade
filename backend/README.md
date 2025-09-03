# Tweet Trade Backend

A Node.js backend API for processing tweets and managing trading workflows.

## Features

- Health check endpoint
- Tweet processing workflow management
- Subscription service management
- PostgreSQL database integration with Neon
- Dify AI workflow integration
- Security middleware (Helmet, CORS, Rate limiting)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy `env.example` to `.env` and fill in your values:
   ```bash
   cp env.example .env
   ```

   Required environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `DIFY_API_KEY`: Your Dify AI API key
   - `PORT`: Server port (default: 3000)
   - `NODE_ENV`: Environment (development/production)

3. **Database Setup:**
   Ensure you have the following tables in your PostgreSQL database:
   - `tweet_processes_submitted`
   - `tweet_processes_completed`
   - `subscription_state`

## Running the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Check API and database health

### Tweet Processing
- `POST /api/process-tweet/trigger-workflow` - Start tweet processing workflow
- `POST /api/process-tweet/workflow-complete` - Handle workflow completion webhook

### Subscription Management
- `POST /api/subscription/start` - Start subscription service
- `GET /api/subscription/status` - Get subscription service status
- `POST /api/subscription/stop` - Stop subscription service

## Project Structure

```
backend/
├── server.js              # Main server file
├── routes/                # Route handlers
│   ├── health.js         # Health check routes
│   ├── process-tweet.js  # Tweet processing routes
│   └── subscription.js   # Subscription management routes
├── package.json          # Dependencies and scripts
├── env.example           # Environment variables template
└── README.md            # This file
```

## Dependencies

- **Express**: Web framework
- **Neon**: PostgreSQL database client
- **Helmet**: Security middleware
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate limiting
- **Dotenv**: Environment variable management
