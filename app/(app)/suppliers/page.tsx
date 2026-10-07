import { listSuppliers, createSupplier, paySupplier, updateSupplier, deleteSupplier, supplierHistory } from "@/actions/suppliers";
import { PartyManager } from "@/components/parties/PartyManager";

export default async function SuppliersPage() {
  const rows = await listSuppliers();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <p className="text-sm text-gray-400">Who you owe and how much.</p>
      </div>
      <PartyManager
        rows={rows}
        dueLabel="You owe"
        totalLabel="Total you have to pay"
        dueHint="Money you still have to pay your suppliers. It goes up when you buy on credit, and down when you tap Pay."
        settleLabel="Pay"
        addLabel="Add supplier"
        onCreate={createSupplier}
        onSettle={paySupplier}
        onUpdate={updateSupplier}
        onDelete={deleteSupplier}
        onHistory={supplierHistory}
      />
    </div>
  );
}
