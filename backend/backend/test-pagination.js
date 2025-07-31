// Manual test to verify pagination logic
function testPaginationLogic() {
  console.log('Testing pagination parameter parsing...\n');
  
  // Test cases
  const testCases = [
    {
      query: { page: '2', limit: '10' },
      expected: { page: 2, limit: 10, offset: 10 }
    },
    {
      query: { page: '3', limit: '5' },
      expected: { page: 3, limit: 5, offset: 10 }
    },
    {
      query: { offset: '20', limit: '10' },
      expected: { page: 3, limit: 10, offset: 20 }
    },
    {
      query: { page: '1' },
      expected: { page: 1, limit: 20, offset: 0 }
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`Test case ${index + 1}:`);
    console.log(`Input: ${JSON.stringify(testCase.query)}`);
    
    // Simulate our pagination logic
    const aggregationOptions = {};
    
    if (testCase.query.limit) {
      aggregationOptions.limit = parseInt(testCase.query.limit, 10);
    }
    
    if (testCase.query.offset) {
      aggregationOptions.offset = parseInt(testCase.query.offset, 10);
    } else if (testCase.query.page) {
      const page = parseInt(testCase.query.page, 10);
      const limit = aggregationOptions.limit || 20;
      aggregationOptions.offset = (page - 1) * limit;
      if (!testCase.query.limit) {
        aggregationOptions.limit = limit;
      }
    }
    
    const currentPage = testCase.query.page ? parseInt(testCase.query.page, 10) : 
                       (aggregationOptions.offset && aggregationOptions.limit ? 
                        Math.floor(aggregationOptions.offset / aggregationOptions.limit) + 1 : 1);
    
    const result = {
      page: currentPage,
      limit: aggregationOptions.limit,
      offset: aggregationOptions.offset
    };
    
    console.log(`Output: ${JSON.stringify(result)}`);
    console.log(`Expected: ${JSON.stringify(testCase.expected)}`);
    console.log(`✅ Match: ${JSON.stringify(result) === JSON.stringify(testCase.expected)}\n`);
  });
  
  // Test date parameter logic
  console.log('Testing date parameter parsing...\n');
  
  const dateTestCases = [
    {
      query: { dateFrom: '2023-01-01', dateTo: '2023-12-31' },
      expected: { startDate: '2023-01-01', endDate: '2023-12-31' }
    },
    {
      query: { startDate: '2023-06-01', endDate: '2023-06-30' },
      expected: { startDate: '2023-06-01', endDate: '2023-06-30' }
    },
    {
      query: { dateFrom: '2023-01-01', startDate: '2023-06-01' },
      expected: { startDate: '2023-01-01', endDate: undefined }
    }
  ];
  
  dateTestCases.forEach((testCase, index) => {
    console.log(`Date test case ${index + 1}:`);
    console.log(`Input: ${JSON.stringify(testCase.query)}`);
    
    // Simulate our date logic
    const startDate = testCase.query.dateFrom || testCase.query.startDate;
    const endDate = testCase.query.dateTo || testCase.query.endDate;
    
    const result = { startDate, endDate };
    
    console.log(`Output: ${JSON.stringify(result)}`);
    console.log(`Expected: ${JSON.stringify(testCase.expected)}`);
    console.log(`✅ Match: ${JSON.stringify(result) === JSON.stringify(testCase.expected)}\n`);
  });
}

testPaginationLogic();
