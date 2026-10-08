export const calculateExpenseTotals = (expenseData) => {
  let inputsCost = 0;
  if (Array.isArray(expenseData.inputs)) {
    expenseData.inputs.forEach(i => {
      if (typeof i.cost === 'number') inputsCost += i.cost;
    });
  }

  let machineryCost = expenseData.machinery?.cost || 0;
  if (!machineryCost && expenseData.machinery?.unitPrice && expenseData.machinery?.quantity) {
    machineryCost = expenseData.machinery.unitPrice * expenseData.machinery.quantity;
    if (expenseData.machinery) expenseData.machinery.cost = machineryCost;
  }

  let labourCost = 0;
  if (expenseData.labour) {
    const family = expenseData.labour.familyLabour || 0;
    const hired = expenseData.labour.hiredLabour || 0;
    const wage = expenseData.labour.dailyWage || 0;
    if (wage > 0 || family > 0 || hired > 0) {
      labourCost = (family + hired) * wage;
      expenseData.labour.cost = labourCost;
    } else {
      labourCost = expenseData.labour.cost || 0;
    }
  }

  const otherCost = expenseData.other?.amount || 0;

  expenseData.subtotals = {
    inputs: inputsCost,
    machinery: machineryCost,
    labour: labourCost,
    other: otherCost,
  };

  expenseData.totalAmount = inputsCost + machineryCost + labourCost + otherCost;
  return expenseData;
};
