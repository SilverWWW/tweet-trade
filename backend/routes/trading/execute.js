const express = require('express');
const axios = require('axios');
const router = express.Router();

const { isMarketOpen, getCurrentStockPrice, findContracts, getOptionContractPrice } = require('./market');

const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2';
const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;

const alpacaClient = axios.create({
  baseURL: ALPACA_BASE_URL,
  headers: {
    'APCA-API-KEY-ID': ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Helper function to validate and format target expiration date
 * @param {string} targetExpiryDate - Target expiration date in YYYY-MM-DD format
 * @returns {string} - Validated and formatted expiration date
 */
function validateTargetExpirationDate(targetExpiryDate) {
  if (!targetExpiryDate || typeof targetExpiryDate !== 'string') {
    throw new Error('Target expiry date is required and must be a string');
  }
  
  const date = new Date(targetExpiryDate);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD format');
  }
  
  const today = new Date();
  if (date <= today) {
    throw new Error('Target expiry date must be in the future');
  }
  
  return targetExpiryDate;
}

/**
 * Helper function to select the best options contract
 * @param {array} contracts - Array of options contracts
 * @param {string} targetExpirationDate - Target expiration date
 * @param {number} currentPrice - Current stock price
 * @returns {object} - Best options contract
 */
function selectBestContract(contracts, targetExpirationDate, currentPrice) {
  if (!contracts || contracts.length === 0) {
    throw new Error('No contracts available for selection');
  }

  // Filter out contracts with more than 25% away from current price
  const reasonableContracts = contracts.filter(contract => {
    const strikePrice = parseFloat(contract.strike_price);
    const priceDiff = Math.abs(strikePrice - currentPrice);
    const priceDiffPercent = (priceDiff / currentPrice) * 100;
    return priceDiffPercent <= 25; // within 25% of current price
  });
  // if no reasonable contracts, use all contracts
  const contractsToSort = reasonableContracts.length > 0 ? reasonableContracts : contracts;

  const sortedContracts = contractsToSort.sort((a, b) => {
    // Primary sort: expiration date proximity to target
    const dateDiffA = Math.abs(new Date(a.expiration_date) - new Date(targetExpirationDate));
    const dateDiffB = Math.abs(new Date(b.expiration_date) - new Date(targetExpirationDate));
    
    if (dateDiffA !== dateDiffB) {
      return dateDiffA - dateDiffB;
    }
    
    // Secondary sort: strike price proximity to current price (but less weight)
    const priceDiffA = Math.abs(parseFloat(a.strike_price) - currentPrice);
    const priceDiffB = Math.abs(parseFloat(b.strike_price) - currentPrice);
    
    return priceDiffA - priceDiffB;
  });

  return sortedContracts[0];
}

/**
 * Helper function to validate common parameters
 * @param {object} params - Parameters to validate
 * @returns {object} - Validation result
 */
function validateCommonParams(params) {
  const { ticker, amount, target_expiry_date } = params;
  const errors = [];

  if (!ticker || typeof ticker !== 'string' || ticker.length === 0) {
    errors.push('Ticker must be a non-empty string');
  }

  if (!amount || amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!target_expiry_date || typeof target_expiry_date !== 'string') {
    errors.push('Target expiry date is required and must be a string');
  } else {
    try {
      validateTargetExpirationDate(target_expiry_date);
    } catch (dateError) {
      errors.push(dateError.message);
    }
  }

  if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
    errors.push('Alpaca API credentials not configured');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to create an options order
 * @param {string} ticker - Stock symbol
 * @param {number} amount - Dollar amount to invest
 * @param {string} targetExpiryDate - Target expiration date in YYYY-MM-DD format
 * @param {string} optionType - 'call' or 'put'
 * @returns {object} - Order result
 */
async function createOptionsOrder(ticker, amount, targetExpiryDate, optionType) {
  const currentPrice = await getCurrentStockPrice(ticker);

  const searchEndDate = new Date(targetExpiryDate);
  searchEndDate.setDate(searchEndDate.getDay() + 90);
  const searchEndDateStr = searchEndDate.toISOString().split('T')[0];

  const contracts = await findContracts(
    ticker,
    targetExpiryDate,
    searchEndDateStr,
    optionType
  );

  if (!contracts || contracts.length === 0) {
    throw new Error(`No ${optionType} options contracts found for ${ticker} near ${targetExpiryDate}`);
  }

  const bestContract = selectBestContract(contracts, targetExpiryDate, currentPrice);

  const contractPrice = await getOptionContractPrice(bestContract.symbol);
  
  const costPerOption = contractPrice * 100; 

  if (costPerOption <= 0) {
    throw new Error(`The selected contract ${bestContract.symbol} has a non-positive price and cannot be traded.`);
  }

  const quantity = Math.floor(amount / costPerOption);
  
  if (quantity <= 0) {
    throw new Error(`Investment of $${amount} is too small to buy a contract priced at $${contractPrice.toFixed(2)} (total cost $${costPerOption.toFixed(2)}).`);
  }

  const orderPayload = {
    symbol: bestContract.symbol,
    qty: quantity,
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
  };

  const response = await alpacaClient.post('/orders', orderPayload);

  return {
    order: response.data,
    requested: {
      ticker: ticker.toUpperCase(),
      amount: amount,
      target_expiry_date: targetExpiryDate,
      quantity: quantity,
      contract: {
        symbol: bestContract.symbol,
        name: bestContract.name,
        expiration_date: bestContract.expiration_date,
        strike_price: bestContract.strike_price,
        type: bestContract.type,
        close_price: bestContract.close_price
      }
    }
  };
}

/**
 * POST /api/trading/execute/option/buy/:type
 * Create a buy order for options (call or put)
 * 
 * @param {string} type - Option type: 'call' or 'put' (required)
 * @param {string} ticker - Stock symbol/ticker (required)
 * @param {number} amount - Dollar amount to invest (required)
 * @param {string} target_expiry_date - Target expiration date in YYYY-MM-DD format (required)
 * 
 * @returns {object} 200 - Order created successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 500 - Server error
 */
router.post('/option/buy/:type', async (req, res) => {
  if (!isMarketOpen()) {
    return res.status(400).json({
      error: 'Market is closed',
      message: 'Trading is only allowed during market hours (Monday-Friday, 9:30 AM - 4:00 PM ET)'
    });
  }

  try {
    const { type } = req.params;
    const { ticker, amount, target_expiry_date } = req.body;

    if (!type || (type !== 'call' && type !== 'put')) {
      return res.status(400).json({
        error: 'Invalid option type',
        message: 'Type must be either "call" or "put"'
      });
    }

    const validation = validateCommonParams({ ticker, amount, target_expiry_date });
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: validation.errors.join(', ')
      });
    }

    const result = await createOptionsOrder(ticker, amount, target_expiry_date, type);

    res.status(200).json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} option buy order created for ${ticker}`,
      order: result.order,
      requested: result.requested
    });

  } catch (error) {
    console.error(`Error creating ${req.params.type} option buy order:`, error);

    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;

      return res.status(statusCode).json({
        error: 'Alpaca API error',
        message: errorData.message || `Failed to create ${req.params.type} option order`,
        details: errorData
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message || `Failed to create ${req.params.type} option buy order`
    });
  }
});

/**
 * DELETE /api/trading/execute/option/close/:symbol
 * Close a position by symbol and percentage
 * 
 * @param {string} symbol - Options contract symbol (required)
 * @param {number} percentage - Percentage of position to close (required, 0-100)
 * 
 * @returns {object} 200 - Position closed successfully
 * @returns {object} 400 - Invalid parameters
 * @returns {object} 404 - Position not found
 * @returns {object} 500 - Server error
 */
router.delete('/option/close/:symbol', async (req, res) => {
  if (!isMarketOpen()) {
    return res.status(400).json({
      error: 'Market is closed',
      message: 'Trading is only allowed during market hours (Monday-Friday, 9:30 AM - 4:00 PM ET)'
    });
  }
  
  try {
    const { symbol } = req.params;
    const { percentage } = req.body;

    if (!symbol || typeof symbol !== 'string' || symbol.length === 0) {
      return res.status(400).json({
        error: 'Invalid symbol parameter',
        message: 'Symbol must be a non-empty string'
      });
    }

    if (!percentage || percentage < 0 || percentage > 100) {
      return res.status(400).json({
        error: 'Invalid percentage parameter',
        message: 'Percentage must be between 0 and 100'
      });
    }

    if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Alpaca API credentials not configured'
      });
    }

    const response = await alpacaClient.delete(`/positions/${encodeURIComponent(symbol)}`, {
      data: {
        percentage: percentage.toString()
      }
    });

    res.status(200).json({
      success: true,
      message: `Position closed for ${symbol} (${percentage}%)`,
      order: response.data,
      requested: {
        symbol: symbol,
        percentage: percentage
      }
    });

  } catch (error) {
    console.error('Error closing position:', error);

    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;

      if (statusCode === 404) {
        return res.status(404).json({
          error: 'Position not found',
          message: `No open position found for symbol: ${req.params.symbol}`
        });
      }

      return res.status(statusCode).json({
        error: 'Alpaca API error',
        message: errorData.message || 'Failed to close position',
        details: errorData
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to close position'
    });
  }
});

module.exports = router;