# Budget Book Chart Configuration Examples

## Revenue Pie Chart (Revenue Summary Section)
```json
{
  "type": "pie",
  "title": "FY2026 Revenue by Source",
  "categoryKey": "source",
  "dataKeys": ["amount"],
  "width": 800,
  "height": 500,
  "data": [
    { "source": "Property Taxes", "amount": 45000000 },
    { "source": "State Aid", "amount": 22000000 },
    { "source": "Fees & Charges", "amount": 8500000 },
    { "source": "Other Revenue", "amount": 4500000 }
  ]
}
```

## Expenditure Grouped Bar (Expenditure Summary Section)
```json
{
  "type": "grouped-bar",
  "title": "Expenditure by Department: Budget vs Prior Year",
  "categoryKey": "department",
  "dataKeys": ["currentBudget", "priorActuals"],
  "width": 800,
  "height": 450,
  "data": [
    { "department": "Police", "currentBudget": 12000000, "priorActuals": 11200000 },
    { "department": "Fire", "currentBudget": 9500000, "priorActuals": 9100000 },
    { "department": "Public Works", "currentBudget": 7200000, "priorActuals": 6800000 },
    { "department": "Parks & Rec", "currentBudget": 3400000, "priorActuals": 3100000 }
  ]
}
```

## Multi-Year Trend Line (Multi-Year Outlook Section)
```json
{
  "type": "line",
  "title": "Five-Year Revenue and Expense Projections",
  "categoryKey": "year",
  "dataKeys": ["revenue", "expense"],
  "width": 800,
  "height": 400,
  "colors": ["#38a169", "#e53e3e"],
  "data": [
    { "year": "FY2026", "revenue": 80000000, "expense": 76000000 },
    { "year": "FY2027", "revenue": 83200000, "expense": 78800000 },
    { "year": "FY2028", "revenue": 86500000, "expense": 81700000 },
    { "year": "FY2029", "revenue": 90000000, "expense": 84800000 },
    { "year": "FY2030", "revenue": 93600000, "expense": 88000000 }
  ]
}
```

## Revenue vs Expense Stacked Bar (Executive Summary Section)
```json
{
  "type": "stacked-bar",
  "title": "Revenue and Expense by Fund",
  "categoryKey": "fund",
  "dataKeys": ["revenue", "expense"],
  "width": 800,
  "height": 400,
  "colors": ["#3182ce", "#e53e3e"],
  "data": [
    { "fund": "General Fund", "revenue": 55000000, "expense": 52000000 },
    { "fund": "Enterprise", "revenue": 15000000, "expense": 14500000 },
    { "fund": "Special Revenue", "revenue": 8000000, "expense": 7800000 },
    { "fund": "Capital Projects", "revenue": 2000000, "expense": 1700000 }
  ]
}
```
