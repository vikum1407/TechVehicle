import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// Helper: extract brand from a single item in the comma-joined description
// e.g. "Oil Change (Castrol), Oil Filter" → extractBrand("Oil Change") → "Castrol"
function extractBrand(description: string, item: string): string | null {
  const re = new RegExp(`${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(([^)]+)\\)`, 'i')
  const m = description.match(re)
  return m ? m[1].trim() : null
}

router.get('/:vehicleId', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerPhone: req.phoneNumber! },
    })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const [serviceRecords, fuelLogs, expenses] = await Promise.all([
      prisma.serviceRecord.findMany({ where: { vehicleId }, orderBy: { date: 'asc' } }),
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

    const mileageTrend = fuelLogs.slice(-12).map(l => ({
      mileage: l.mileage,
      label: new Date(l.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    }))

    const efficiencyPoints: { kmPerL: number; label: string }[] = []
    for (let i = 1; i < fuelLogs.length; i++) {
      const prev = fuelLogs[i - 1]
      const curr = fuelLogs[i]
      if (curr.litres && curr.litres > 0 && curr.mileage > prev.mileage) {
        efficiencyPoints.push({
          kmPerL: parseFloat(((curr.mileage - prev.mileage) / curr.litres).toFixed(1)),
          label: new Date(curr.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        })
      }
    }
    const fuelEfficiencyTrend = efficiencyPoints.slice(-12)

    const fuelCostTrend = fuelLogs
      .filter(l => l.cost != null && (l.cost as number) > 0)
      .slice(-10)
      .map(l => ({
        cost: l.cost as number,
        label: new Date(l.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      }))

    // ── Structured analytics ───────────────────────────────────────────────────

    // Oil Change History
    const oilRecords = serviceRecords
      .filter(r => r.description.toLowerCase().includes('oil change'))
      .slice(-8)

    let oilAnalytics = null
    if (oilRecords.length > 0) {
      const history = oilRecords.map((r, i) => {
        const sd = (r.structuredData as any)?.['Oil Change'] || {}
        const prev = oilRecords[i - 1]
        return {
          date: r.date.toISOString(),
          km: r.mileage,
          brand: sd.oilBrand || extractBrand(r.description, 'Oil Change') || r.brand || null,
          grade: sd.oilGrade || null,
          oilType: sd.oilType || null,
          intervalKm: r.mileage && prev?.mileage ? r.mileage - prev.mileage : null,
        }
      }).reverse()  // most recent first
      oilAnalytics = { history }
    }

    // Tyre Change History
    const tyreRecords = serviceRecords
      .filter(r => r.description.toLowerCase().includes('tyre change'))
      .slice(-5)

    let tyreAnalytics = null
    if (tyreRecords.length > 0) {
      const history = tyreRecords.map((r, i) => {
        const sd = (r.structuredData as any)?.['Tyre Change'] || {}
        const prev = tyreRecords[i - 1]
        return {
          date: r.date.toISOString(),
          km: r.mileage,
          size: sd.tyreSize || null,
          brand: sd.tyreBrand || extractBrand(r.description, 'Tyre Change') || r.brand || null,
          tyresChanged: sd.tyresChanged || null,
          kmThisSet: r.mileage && prev?.mileage ? r.mileage - prev.mileage : null,
        }
      }).reverse()
      tyreAnalytics = {
        history,
        currentSize: history[0]?.size || null,
      }
    }

    // Emission Test History
    const emissionRecords = serviceRecords
      .filter(r => r.description.toLowerCase().includes('emission test'))

    let emissionAnalytics = null
    if (emissionRecords.length > 0) {
      const history = emissionRecords.map(r => {
        const sd = (r.structuredData as any)?.['Emission Test / Carbon Test'] || {}
        return {
          date: r.date.toISOString(),
          km: r.mileage,
          co:     sd.co     ? parseFloat(sd.co)     : null,
          hc:     sd.hc     ? parseFloat(sd.hc)     : null,
          co2:    sd.co2    ? parseFloat(sd.co2)    : null,
          lambda: sd.lambda ? parseFloat(sd.lambda) : null,
          result:  sd.result  || null,
          station: sd.station || null,
        }
      })

      let warning: string | null = null
      const lastEntry = history[history.length - 1]

      if (lastEntry.result === 'Fail') {
        warning = 'Last emission test FAILED. Engine service recommended before next revenue licence renewal.'
      } else {
        const hcReadings = history.map(e => e.hc).filter(h => h !== null) as number[]
        if (hcReadings.length >= 2) {
          const first = hcReadings[0]
          const last  = hcReadings[hcReadings.length - 1]
          if (last > first * 1.5 && last > 150) {
            warning = `HC reading increased from ${first} to ${last} ppm. This may indicate early oil burning — consider a compression test.`
          }
        }
      }

      emissionAnalytics = { history: history.slice().reverse(), warning }
    }

    // AC Gas Refill History
    const acRecords = serviceRecords
      .filter(r => r.description.toLowerCase().includes('ac gas refill'))

    let acAnalytics = null
    if (acRecords.length > 0) {
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      const refillCount12m = acRecords.filter(r => new Date(r.date) > oneYearAgo).length

      const history = acRecords.slice(-6).map(r => {
        const sd = (r.structuredData as any)?.['AC Gas Refill'] || {}
        return {
          date: r.date.toISOString(),
          km: r.mileage,
          refrigerantType: sd.refrigerantType || extractBrand(r.description, 'AC Gas Refill') || r.brand || null,
          quantityGrams: sd.quantityGrams ? parseFloat(sd.quantityGrams) : null,
        }
      }).reverse()

      let warning: string | null = null
      if (refillCount12m >= 2) {
        warning = `${refillCount12m} AC refills in the past 12 months. Frequent refills suggest a refrigerant leak — a leak test could save significant fuel cost.`
      }

      acAnalytics = { history, refillCount12m, warning }
    }

    res.json({
      totalSpend, serviceCost, fuelCost, expenseTotal,
      expenseBreakdown, avgFuelEfficiency, costPerKm, monthlySpend,
      mileageTrend, fuelEfficiencyTrend, fuelCostTrend,
      recordCounts: {
        services: serviceRecords.length,
        fuelLogs: fuelLogs.length,
        expenses: expenses.length,
      },
      oilAnalytics,
      tyreAnalytics,
      emissionAnalytics,
      acAnalytics,
    })
  } catch (error) {
    console.error('GET /analytics error:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

export default router
