type RecordedMeal = { date: string; ingredients: { name: string }[] };
export type HabitBalanceTone = "good" | "low" | "high" | "learning";

// Seven calendar days, including today. Purchases are not proof of consumption.
export function habitBalanceSignals(state: { mealHistory: RecordedMeal[] }, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const meals = state.mealHistory.filter(meal => {
    const date = new Date(meal.date + "T00:00:00");
    return date >= start && date <= end;
  });
  const patterns = [
    { key: "protein", label: "Proteína", re: /pollo|carne|pescado|huevo|proteina|legumbre|lenteja|garbanzo|tofu|seitan/ },
    { key: "veg", label: "Verdura", re: /verdura|tomate|zanahoria|cebolla|aguacate|brocoli|lechuga|pepino|espinaca/ },
    { key: "carbs", label: "Carbohidratos", re: /arroz|pasta|pan|patata|avena|cereal|quinoa|cuscus/ },
    { key: "sweets", label: "Dulces", re: /chocolate|galleta|chuche|gominola|snack|bolleria|refresco|helado/ },
  ] as const;
  if (meals.length < 4) return patterns.map(p => ({ ...p, tone: "learning" as HabitBalanceTone, status: "Aprendiendo", ratio: 0 }));
  return patterns.map(p => {
    const ratio = meals.filter(m => m.ingredients.some(i => p.re.test(i.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))).length / meals.length;
    let tone: HabitBalanceTone = "good", status = "Bien";
    if ((p.key === "protein" || p.key === "veg") && ratio < .4 || p.key === "carbs" && ratio < .25) {
      tone = "low"; status = "Bajo";
    } else if (p.key === "carbs" && ratio > .9 || p.key === "sweets" && ratio > .4) {
      tone = "high"; status = "Alto";
    }
    return { ...p, tone, status, ratio };
  });
}
