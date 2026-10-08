import { requireView } from "@/lib/context";
import { listExpenses } from "@/actions/expenses";
import { ExpenseManager } from "@/components/expenses/ExpenseManager";

export default async function ExpensesPage() {
  await requireView("expenses");
  const expenses = await listExpenses();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <p className="text-sm text-gray-400">Shop running costs — rent, salary, electricity and more.</p>
      </div>
      <ExpenseManager initial={expenses} />
    </div>
  );
}
