import { listCustomers, createCustomer, receiveCustomerPayment, updateCustomer, deleteCustomer, customerHistory } from "@/actions/customers";
import { PartyManager } from "@/components/parties/PartyManager";

export default async function CustomersPage() {
  const rows = await listCustomers();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-gray-400">Who owes you and how much.</p>
      </div>
      <PartyManager
        rows={rows}
        dueLabel="Owes you"
        totalLabel="Total to collect"
        dueHint="Money customers still have to pay you. It goes up when a bill is part-paid, and down when you tap Receive."
        settleLabel="Receive"
        addLabel="Add customer"
        onCreate={createCustomer}
        onSettle={receiveCustomerPayment}
        onUpdate={updateCustomer}
        onDelete={deleteCustomer}
        onHistory={customerHistory}
      />
    </div>
  );
}
