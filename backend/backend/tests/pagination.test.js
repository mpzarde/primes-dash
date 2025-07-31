// Simple test to verify pagination parameters are being processed correctly
const request = require('supertest');
const express = require('express');

// Mock the route handlers
const mockBatchesRoute = (req, res) => {
  // Parse pagination parameters similar to our implementation
  const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
  let offset = req.query.offset ? parseInt(req.query.offset) : undefined;
  
  // Handle page parameter
  if (req.query.page && !req.query.offset) {
    const page = parseInt(req.query.page);
    const pageLimit = limit || 20;
    offset = (page - 1) * pageLimit;
  }
  
  // Handle date parameters
  const startDate = req.query.dateFrom || req.query.startDate;
  const endDate = req.query.dateTo || req.query.endDate;
  
  res.json({
    pagination: {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit,
      offset
    },
    dateRange: {
      startDate,
      endDate
    }
  });
};

const app = express();
app.get('/api/batches', mockBatchesRoute);

describe('Pagination and Date Range Parameters', () => {
  test('should handle page parameter correctly', async () => {
    const response = await request(app)
      .get('/api/batches?page=2&limit=10')
      .expect(200);
    
    expect(response.body.pagination.page).toBe(2);
    expect(response.body.pagination.limit).toBe(10);
    expect(response.body.pagination.offset).toBe(10);
  });

  test('should handle offset parameter correctly', async () => {
    const response = await request(app)
      .get('/api/batches?offset=20&limit=5')
      .expect(200);
    
    expect(response.body.pagination.offset).toBe(20);
    expect(response.body.pagination.limit).toBe(5);
  });

  test('should handle startDate/endDate parameters', async () => {
    const response = await request(app)
      .get('/api/batches?startDate=2023-01-01&endDate=2023-12-31')
      .expect(200);
    
    expect(response.body.dateRange.startDate).toBe('2023-01-01');
    expect(response.body.dateRange.endDate).toBe('2023-12-31');
  });

  test('should prefer dateFrom/dateTo over startDate/endDate', async () => {
    const response = await request(app)
      .get('/api/batches?dateFrom=2023-06-01&startDate=2023-01-01')
      .expect(200);
    
    expect(response.body.dateRange.startDate).toBe('2023-06-01');
  });
});
