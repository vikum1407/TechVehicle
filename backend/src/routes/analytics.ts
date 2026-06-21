import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const [serviceRecords, fuelLogs, expenses] = await Promise.all([
      prisma.serviceRecord.findMany({ where: { vehicleId } }),
      prisma.fuelLog.findMany({ where: { vehicleId }, orderBy: { date: 'asc' } }),
      prisma.expense.findMany({ where: { vehicleId } }),
    ])

    const serviceCost = serviceRecords.reduce((s, r) => s + (r.cost || 0), 0)
    const fuelCost = fuelLogs.reduce((s, l) => s + (l.cost || 0), 0)
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
    const totalSpend = serviceCost + fuelCost + expenseTotal

    const categoryMap: Record<string, number> = {}
    expenses.forEach(e => { categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount })
    if (serviceCost > 0) categoryMap['Service & Repairs'] = serviceCost
    if (fuelCost > 0) categoryMap['Fuel'] = fuelCost
    const expenseBreakdown = Object.entries(categoryMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    let avgFuelEfficiency: number | null = null
    if (fuelLogs.length >= 2) {
      const efficiencies: number[] = []
      for (let i = 1; i < fuelLogs.length; i++) {
        const prev = fuelLogs[i - 1]
        const curr = fuelLogs[i]
        if (curr.litres && curr.litres > 0 && curr.mileage > prev.mileage) {
          efficiencies.push((curr.mileage - prev.mileage) / curr.litres)
        }
      }
      if (efficiencies.length > 0)
        avgFuelEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length
    }

    let costPerKm: number | null = null
    const allMileages = [
      ...serviceRecords.filter(r => r.mileage).map(r => r.mileage as number),
      ...fuelLogs.map(l => l.mileage),
      ...expenses.filter(e => e.mileage).map(e => e.mileage as number),
    ]
    if (allMileages.length >= 2 && totalSpend > 0) {
      const range = Math.max(...allMileages) - Math.min(...allMileages)
      if (range > 0) costPerKm = totalSpend / range
    }

    const now = new Date()
    const monthlyMap: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyMap[key] = 0
    }
    const addToMonth = (date: Date, amount: number) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (key in monthlyMap) monthlyMap[key] += amount
    }
    serviceRecords.forEach(r => r.cost && addToMonth(new Date(r.date), r.cost))
    fuelLogs.forEach(l => l.cost && addToMonth(new Date(l.date), l.cost))
    expenses.forEach(e => addToMonth(new Date(e.date), e.amount))
    const monthlySpend = Object.entries(monthlyMap).map(([month, amount]) => {
      const [y, m] = month.split('-')
      const label = new Date(parseInt(y), parseInt(m) - 1, 1)
        .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      return { month: label, amount }
    })

    res.json({
      totalSpend, serviceCost, fuelCost, expenseTotal,
      expenseBreakdown, avgFuelEfficiency, costPerKm, monthlySpend,
      recordCounts: {
        services: serviceRecords.length,
        fuelLogs: fuelLogs.length,
        expenses: expenses.length,
      },
    })
  } catch (error) {
    console.error('GET /analytics error:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

export default router
